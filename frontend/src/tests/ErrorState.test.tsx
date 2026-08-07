import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorState } from "../components/ui/ErrorState";

describe("ErrorState", () => {
  it("renders the error message", () => {
    render(<ErrorState message="Failed to load data" />);
    expect(screen.getByText("Failed to load data")).toBeInTheDocument();
  });

  it("renders detail text when provided", () => {
    render(<ErrorState message="Error" detail="Network timeout" />);
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
  });

  it("shows retry button when onRetry is provided and severity is recoverable", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("does not show retry button when severity is terminal", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} severity="terminal" />);
    expect(screen.queryByText("Try Again")).not.toBeInTheDocument();
    expect(screen.getByText(/cannot be resolved/i)).toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Try Again"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("has role=alert for screen reader accessibility", () => {
    render(<ErrorState message="Error" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders compact mode correctly", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Compact error" onRetry={onRetry} compact />);
    expect(screen.getByText("Compact error")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });
});
