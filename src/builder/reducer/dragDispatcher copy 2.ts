import { produce } from "immer";
import { Node } from "./nodeDispatcher";
import { LineIndicatorState } from "../context/builderState";


export interface DragState {
 
  contextMenu?: {
    show: boolean;
    x: number;
    y: number;
    nodeId: string | null;
    isViewportHeader?: boolean;
  } | null;
  
  viewportContextMenu: {
    show: boolean;
    viewportId: string | number | null;
    position: {
      x: number;
      y: number;
    };
  };
}

}

export class DragDispatcher {
  constructor(
    private setState: React.Dispatch<React.SetStateAction<DragState>>
  ) {}


  setContextMenu(
    x: number,
    y: number,
    nodeId: string | null,
    isViewportHeader: boolean = false
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.contextMenu = { show: true, x, y, nodeId, isViewportHeader };
      })
    );
  }

  hideContextMenu() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.contextMenu = null;
      })
    );
  }


  showViewportContextMenu(
    viewportId: string | number,
    position: { x: number; y: number }
  ) {
    this.setState(
      produce((draft) => {
        draft.viewportContextMenu = {
          show: true,
          viewportId,
          position,
        };
      })
    );
  }

  hideViewportContextMenu() {
    this.setState(
      produce((draft) => {
        draft.viewportContextMenu.show = false;
      })
    );
  }
