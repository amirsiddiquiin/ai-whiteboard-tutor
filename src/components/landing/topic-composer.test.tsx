import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLessonStore } from "@/features/lesson/store";
import { createValidLesson } from "@/tests/fixtures/lesson";

import { TopicComposer } from "./topic-composer";

describe("TopicComposer", () => {
  beforeEach(() => {
    useLessonStore.setState({
      activeRequestId: null,
      error: null,
      lesson: null,
      status: "idle",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies a suggested topic into the composer", async () => {
    const user = userEvent.setup();
    render(<TopicComposer />);

    await user.click(screen.getByRole("button", { name: "How binary search works" }));

    expect(screen.getByLabelText("What would you like to learn?")).toHaveValue(
      "How binary search works",
    );
  });

  it("shows validation feedback without making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<TopicComposer />);

    await user.click(screen.getByRole("button", { name: "Create my lesson" }));

    expect(screen.getByRole("alert")).toHaveTextContent("at least two characters");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a provider error and allows another submission", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: { message: "Lesson generation is busy. Try again shortly." },
        }),
      }),
    );
    const user = userEvent.setup();
    render(<TopicComposer />);

    await user.type(screen.getByLabelText("What would you like to learn?"), "Binary search");
    await user.click(screen.getByRole("button", { name: "Create my lesson" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Try again shortly");
    expect(screen.getByRole("button", { name: "Create my lesson" })).toBeEnabled();
  });

  it("stores a schema-validated successful lesson", async () => {
    const lesson = createValidLesson();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lesson }) }),
    );
    const user = userEvent.setup();
    render(<TopicComposer />);

    await user.type(screen.getByLabelText("What would you like to learn?"), "Binary search");
    await user.click(screen.getByRole("button", { name: "Create my lesson" }));

    expect(await screen.findByText("Lesson generated and validated successfully.")).toBeVisible();
    expect(useLessonStore.getState().lesson?.topic).toBe("Binary search");
  });

  it("disables duplicate submissions while Gemini is generating", async () => {
    let resolveRequest!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const fetchMock = vi.fn().mockImplementation(
      () => new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<TopicComposer />);

    await user.type(screen.getByLabelText("What would you like to learn?"), "Binary search");
    await user.click(screen.getByRole("button", { name: "Create my lesson" }));

    const loadingButton = screen.getByRole("button", { name: "Generating…" });
    expect(loadingButton).toBeDisabled();
    await user.click(loadingButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const lesson = createValidLesson();
    resolveRequest({ ok: true, json: async () => ({ lesson }) });
    expect(await screen.findByText("Lesson generated and validated successfully.")).toBeVisible();
  });
});
