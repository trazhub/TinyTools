"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  appName: string;
  onClose: () => void;
  children: ReactNode;
}

/** Keeps a crashing app from taking the whole desktop down with it. */
export class AppErrorBoundary extends Component<Props, { error: Error | null; attempt: number }> {
  state = { error: null as Error | null, attempt: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log the technical details for developers; the user sees a friendly message.
    console.error(`[TinyTools OS] ${this.props.appName} crashed`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return <div key={this.state.attempt} className="contents">{this.props.children}</div>;
    }
    return (
      <div role="alert" className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <AlertTriangle className="mx-auto size-8 text-warning" aria-hidden />
          <h2 className="text-base font-semibold">{this.props.appName} ran into a problem</h2>
          <p className="text-sm text-muted-foreground">
            The rest of your desktop is fine. Your files are safe. You can restart the app or close its window.
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}>Restart app</Button>
            <Button variant="outline" onClick={this.props.onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
