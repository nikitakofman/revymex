import { produce } from "immer";

export interface InterfaceState {
  isInsertOpen: boolean;
  isLayersOpen: boolean;
  isCmsOpen: boolean;
  isPreviewOpen: boolean;
  isPagesOpen: boolean;
  isComponentsOpen: boolean;
  isTyping: boolean;
  previewWidth: number | null;
}

export class InterfaceDispatcher {
  constructor(
    private setState: React.Dispatch<React.SetStateAction<InterfaceState>>
  ) {}

  toggleInsert() {
    this.setState(
      produce((draft) => {
        draft.isInsertOpen = !draft.isInsertOpen;
        if (draft.isInsertOpen) {
          draft.isLayersOpen = false;
          draft.isCmsOpen = false;
          draft.isPagesOpen = false;
          draft.isComponentsOpen = false;
          draft.isPreviewOpen = false;
        }
      })
    );
  }

  toggleLayers() {
    this.setState(
      produce((draft) => {
        draft.isLayersOpen = !draft.isLayersOpen;
        if (draft.isLayersOpen) {
          draft.isInsertOpen = false;
          draft.isCmsOpen = false;
          draft.isPagesOpen = false;
          draft.isComponentsOpen = false;
          draft.isPreviewOpen = false;
        }
      })
    );
  }

  toggleCms() {
    this.setState(
      produce((draft) => {
        draft.isCmsOpen = !draft.isCmsOpen;
        if (draft.isCmsOpen) {
          draft.isInsertOpen = false;
          draft.isLayersOpen = false;
          draft.isPagesOpen = false;
          draft.isComponentsOpen = false;
          draft.isPreviewOpen = false;
        }
      })
    );
  }

  togglePages() {
    this.setState(
      produce((draft) => {
        draft.isPagesOpen = !draft.isPagesOpen;
        if (draft.isPagesOpen) {
          draft.isCmsOpen = false;
          draft.isInsertOpen = false;
          draft.isPreviewOpen = false;
          draft.isLayersOpen = false;
          draft.isComponentsOpen = false;
        }
      })
    );
  }

  toggleComponents() {
    this.setState(
      produce((draft) => {
        draft.isComponentsOpen = !draft.isComponentsOpen;
        if (draft.isComponentsOpen) {
          draft.isCmsOpen = false;
          draft.isInsertOpen = false;
          draft.isPreviewOpen = false;
          draft.isLayersOpen = false;
          draft.isPagesOpen = false;
        }
      })
    );
  }

  togglePreview() {
    this.setState(
      produce((draft) => {
        draft.isPreviewOpen = !draft.isPreviewOpen;
        if (draft.isPreviewOpen) {
          draft.isCmsOpen = false;
          draft.isInsertOpen = false;
          draft.isLayersOpen = false;
          draft.isComponentsOpen = false;
          draft.isPagesOpen = false;
        }
      })
    );
  }

  setIsTyping() {
    this.setState(
      produce((draft) => {
        draft.isTyping = !draft.isTyping;
      })
    );
  }

  setPreviewWidth(width: number | null) {
    this.setState(
      produce((draft) => {
        draft.previewWidth = width;
      })
    );
  }
}
