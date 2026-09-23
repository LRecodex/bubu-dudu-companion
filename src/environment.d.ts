interface Window {
  companion: {
    getAlwaysOnTop(): Promise<boolean>;
    setAlwaysOnTop(value: boolean): Promise<boolean>;
    close(): Promise<void>;
    openShop(): Promise<void>;
    closeShop(): Promise<void>;
    roomCommand(command: { type: string; id?: string }): void;
    publishRoom(state: import('./game/furniture').RoomSave): void;
    onRoomCommand(callback: (command: { type: string; id?: string }) => void): () => void;
    onRoomState(callback: (state: import('./game/furniture').RoomSave) => void): () => void;
  };
}
