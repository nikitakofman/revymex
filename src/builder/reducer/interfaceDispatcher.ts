import { produce } from "immer";

export interface InterfaceState {
  isInsertOpen: boolean;
  isLayersOpen: boolean;
  isCmsOpen: boolean;
  isPreviewOpen: boolean;
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
        }
      })
    );
  }

  togglePreview() {
    this.setState(
      produce((draft) => {
        draft.isPreviewOpen = !draft.isPreviewOpen;
      })
    );
  }
}
