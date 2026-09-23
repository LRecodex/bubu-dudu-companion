interface Window {
  companion: {
    getAlwaysOnTop(): Promise<boolean>;
    setAlwaysOnTop(value: boolean): Promise<boolean>;
    close(): Promise<void>;
  };
}
