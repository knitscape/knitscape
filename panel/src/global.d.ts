declare module "@eastdesire/jscolor" {
  interface JSColorOptions {
    format?: string;
    alpha?: boolean;
    onChange?: () => void;
    [key: string]: unknown;
  }

  class JSColor {
    constructor(element: HTMLElement, options?: JSColorOptions);
    fromString(value: string): void;
    toString(): string;
    hide(): void;
    show(): void;
  }

  export = JSColor;
}
