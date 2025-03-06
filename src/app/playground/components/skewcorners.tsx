"use client";

import React, { useState, useEffect, useRef } from "react";

/* -------------------------------------------
   1) 2D-ONLY MATRIX HELPERS
--------------------------------------------*/
function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function multiply2D(A: number[], B: number[]) {
  // Multiply two 3x3 matrices (row-major order)
  const C = new Array(9).fill(0);
  C[0] = A[0] * B[0] + A[1] * B[3] + A[2] * B[6];
  C[1] = A[0] * B[1] + A[1] * B[4] + A[2] * B[7];
  C[2] = A[0] * B[2] + A[1] * B[5] + A[2] * B[8];

  C[3] = A[3] * B[0] + A[4] * B[3] + A[5] * B[6];
  C[4] = A[3] * B[1] + A[4] * B[4] + A[5] * B[7];
  C[5] = A[3] * B[2] + A[4] * B[5] + A[5] * B[8];

  C[6] = A[6] * B[0] + A[7] * B[3] + A[8] * B[6];
  C[7] = A[6] * B[1] + A[7] * B[4] + A[8] * B[7];
  C[8] = A[6] * B[2] + A[7] * B[5] + A[8] * B[8];
  return C;
}

function applyMatrixToPoint(m: number[], x: number, y: number) {
  const nx = m[0] * x + m[1] * y + m[2];
  const ny = m[3] * x + m[4] * y + m[5];
  return { x: nx, y: ny };
}

/**
 * build2DMatrix: creates a 3x3 matrix given translation (tx, ty),
 * a pivot (cx, cy), scale factors, skew angles, and rotation angle.
 * The order is:
 *   1) Translate by (tx, ty)
 *   2) Translate by (cx, cy) to set the pivot
 *   3) Scale
 *   4) SkewX then SkewY
 *   5) Rotate
 *   6) Translate back by (-cx, -cy)
 */
function build2DMatrix({
  tx,
  ty,
  cx,
  cy,
  scaleX,
  scaleY,
  skewXDeg,
  skewYDeg,
  rotateDeg,
}: {
  tx: number;
  ty: number;
  cx: number;
  cy: number;
  scaleX: number;
  scaleY: number;
  skewXDeg: number;
  skewYDeg: number;
  rotateDeg: number;
}) {
  let M = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  // 1) Translate by (tx, ty)
  M = multiply2D(M, [1, 0, tx, 0, 1, ty, 0, 0, 1]);

  // 2) Translate to pivot (cx, cy)
  M = multiply2D(M, [1, 0, cx, 0, 1, cy, 0, 0, 1]);

  // 3) Scale
  M = multiply2D(M, [scaleX, 0, 0, 0, scaleY, 0, 0, 0, 1]);

  // 4) SkewX
  const sx = Math.tan(degToRad(skewXDeg));
  M = multiply2D(M, [1, sx, 0, 0, 1, 0, 0, 0, 1]);

  // 5) SkewY
  const sy = Math.tan(degToRad(skewYDeg));
  M = multiply2D(M, [1, 0, 0, sy, 1, 0, 0, 0, 1]);

  // 6) Rotate
  const angle = degToRad(rotateDeg);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  M = multiply2D(M, [cosA, -sinA, 0, sinA, cosA, 0, 0, 0, 1]);

  // 7) Translate back from pivot
  M = multiply2D(M, [1, 0, -cx, 0, 1, -cy, 0, 0, 1]);

  return M;
}

// Helper: Convert 3x3 matrix to a CSS matrix(a, b, c, d, e, f) string.
function matrixToCss(m: number[]) {
  return `matrix(${m[0]}, ${m[3]}, ${m[1]}, ${m[4]}, ${m[2]}, ${m[5]})`;
}

export default function Home() {
  // Layout constants for the parent box
  const posLeft = 100;
  const posTop = 100;
  const boxWidth = 220;
  const boxHeight = 140;

  // Parent transform controls
  const [parentSkewX, setParentSkewX] = useState(0);
  const [parentSkewY, setParentSkewY] = useState(0);
  const [parentScaleX, setParentScaleX] = useState(1);
  const [parentScaleY, setParentScaleY] = useState(1);
  const [parentRotate, setParentRotate] = useState(0);

  // Child transform controls
  const [childSkewX, setChildSkewX] = useState(0);
  const [childSkewY, setChildSkewY] = useState(0);
  const [childScaleX, setChildScaleX] = useState(0.7);
  const [childScaleY, setChildScaleY] = useState(0.7);
  const [childRotate, setChildRotate] = useState(0);

  // Grandchild transform controls
  const [grandchildSkewX, setGrandchildSkewX] = useState(0);
  const [grandchildSkewY, setGrandchildSkewY] = useState(0);
  const [grandchildScaleX, setGrandchildScaleX] = useState(0.7);
  const [grandchildScaleY, setGrandchildScaleY] = useState(0.7);
  const [grandchildRotate, setGrandchildRotate] = useState(0);

  // Dimensions for the child box (inset inside parent)
  const childMargin = 20;
  const childWidth = boxWidth - childMargin * 2;
  const childHeight = boxHeight - childMargin * 2;

  // Dimensions for the grandchild box (inset inside child)
  const grandchildMargin = 20;
  const grandchildWidth = childWidth - grandchildMargin * 2;
  const grandchildHeight = childHeight - grandchildMargin * 2;

  // State for computed CSS transforms and corner positions
  const [parentMatrixCss, setParentMatrixCss] = useState("");
  const [childMatrixCss, setChildMatrixCss] = useState("");
  const [grandchildMatrixCss, setGrandchildMatrixCss] = useState("");

  const [parentCorners, setParentCorners] = useState<any>(null);
  const [childCorners, setChildCorners] = useState<any>(null);
  const [grandchildCorners, setGrandchildCorners] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Parent global matrix (pivot at parent's center)
    const parentMatrix = build2DMatrix({
      tx: posLeft,
      ty: posTop,
      cx: boxWidth / 2,
      cy: boxHeight / 2,
      scaleX: parentScaleX,
      scaleY: parentScaleY,
      skewXDeg: parentSkewX,
      skewYDeg: parentSkewY,
      rotateDeg: parentRotate,
    });
    setParentMatrixCss(matrixToCss(parentMatrix));

    // Parent corners in global space
    const pTL = applyMatrixToPoint(parentMatrix, 0, 0);
    const pTR = applyMatrixToPoint(parentMatrix, boxWidth, 0);
    const pBR = applyMatrixToPoint(parentMatrix, boxWidth, boxHeight);
    const pBL = applyMatrixToPoint(parentMatrix, 0, boxHeight);
    setParentCorners({
      topLeft: pTL,
      topRight: pTR,
      bottomRight: pBR,
      bottomLeft: pBL,
      edgeTop: { x: (pTL.x + pTR.x) / 2, y: (pTL.y + pTR.y) / 2 },
      edgeRight: { x: (pTR.x + pBR.x) / 2, y: (pTR.y + pBR.y) / 2 },
      edgeBottom: { x: (pBL.x + pBR.x) / 2, y: (pBL.y + pBR.y) / 2 },
      edgeLeft: { x: (pTL.x + pBL.x) / 2, y: (pTL.y + pBL.y) / 2 },
    });

    // Child local matrix (child inset inside parent)
    const childLocalMatrix = build2DMatrix({
      tx: childMargin,
      ty: childMargin,
      cx: childWidth / 2,
      cy: childHeight / 2,
      scaleX: childScaleX,
      scaleY: childScaleY,
      skewXDeg: childSkewX,
      skewYDeg: childSkewY,
      rotateDeg: childRotate,
    });

    // Child global matrix = parent's matrix * child's local matrix
    const childGlobalMatrix = multiply2D(parentMatrix, childLocalMatrix);
    setChildMatrixCss(matrixToCss(childGlobalMatrix));

    // Child corners in global space
    const cTL = applyMatrixToPoint(childGlobalMatrix, 0, 0);
    const cTR = applyMatrixToPoint(childGlobalMatrix, childWidth, 0);
    const cBR = applyMatrixToPoint(childGlobalMatrix, childWidth, childHeight);
    const cBL = applyMatrixToPoint(childGlobalMatrix, 0, childHeight);
    setChildCorners({
      topLeft: cTL,
      topRight: cTR,
      bottomRight: cBR,
      bottomLeft: cBL,
      edgeTop: { x: (cTL.x + cTR.x) / 2, y: (cTL.y + cTR.y) / 2 },
      edgeRight: { x: (cTR.x + cBR.x) / 2, y: (cTR.y + cBR.y) / 2 },
      edgeBottom: { x: (cBL.x + cBR.x) / 2, y: (cBL.y + cBR.y) / 2 },
      edgeLeft: { x: (cTL.x + cBL.x) / 2, y: (cTL.y + cBL.y) / 2 },
    });

    // Grandchild local matrix (grandchild inset inside child)
    const grandchildLocalMatrix = build2DMatrix({
      tx: grandchildMargin,
      ty: grandchildMargin,
      cx: grandchildWidth / 2,
      cy: grandchildHeight / 2,
      scaleX: grandchildScaleX,
      scaleY: grandchildScaleY,
      skewXDeg: grandchildSkewX,
      skewYDeg: grandchildSkewY,
      rotateDeg: grandchildRotate,
    });

    // Grandchild global matrix = child's global matrix * grandchild's local matrix
    const grandchildGlobalMatrix = multiply2D(
      childGlobalMatrix,
      grandchildLocalMatrix
    );
    setGrandchildMatrixCss(matrixToCss(grandchildGlobalMatrix));

    // Grandchild corners in global space
    const gTL = applyMatrixToPoint(grandchildGlobalMatrix, 0, 0);
    const gTR = applyMatrixToPoint(grandchildGlobalMatrix, grandchildWidth, 0);
    const gBR = applyMatrixToPoint(
      grandchildGlobalMatrix,
      grandchildWidth,
      grandchildHeight
    );
    const gBL = applyMatrixToPoint(grandchildGlobalMatrix, 0, grandchildHeight);
    setGrandchildCorners({
      topLeft: gTL,
      topRight: gTR,
      bottomRight: gBR,
      bottomLeft: gBL,
      edgeTop: { x: (gTL.x + gTR.x) / 2, y: (gTL.y + gTR.y) / 2 },
      edgeRight: { x: (gTR.x + gBR.x) / 2, y: (gTR.y + gBR.y) / 2 },
      edgeBottom: { x: (gBL.x + gBR.x) / 2, y: (gBL.y + gBR.y) / 2 },
      edgeLeft: { x: (gTL.x + gBL.x) / 2, y: (gTL.y + gBL.y) / 2 },
    });
  }, [
    posLeft,
    posTop,
    boxWidth,
    boxHeight,
    parentSkewX,
    parentSkewY,
    parentScaleX,
    parentScaleY,
    parentRotate,
    childMargin,
    childWidth,
    childHeight,
    childSkewX,
    childSkewY,
    childScaleX,
    childScaleY,
    childRotate,
    grandchildMargin,
    grandchildWidth,
    grandchildHeight,
    grandchildSkewX,
    grandchildSkewY,
    grandchildScaleX,
    grandchildScaleY,
    grandchildRotate,
  ]);

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-xl mb-4">
        Nested 2D Transform Handles (Recursive Grandchild with Rotation)
      </h1>
      {/* Controls */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-6xl mb-8">
        {/* Parent Controls */}
        <div className="space-y-2 border p-4 rounded border-blue-500">
          <h2 className="text-lg font-bold text-blue-400">Parent Controls</h2>
          <div>
            <label>Rotate: {parentRotate}°</label>
            <input
              type="range"
              min="-180"
              max="180"
              value={parentRotate}
              onChange={(e) => setParentRotate(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label>SkewX: {parentSkewX}°</label>
            <input
              type="range"
              min="-50"
              max="50"
              value={parentSkewX}
              onChange={(e) => setParentSkewX(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label>SkewY: {parentSkewY}°</label>
            <input
              type="range"
              min="-50"
              max="50"
              value={parentSkewY}
              onChange={(e) => setParentSkewY(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label>ScaleX: {parentScaleX.toFixed(2)}</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={parentScaleX}
              onChange={(e) => setParentScaleX(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label>ScaleY: {parentScaleY.toFixed(2)}</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={parentScaleY}
              onChange={(e) => setParentScaleY(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
        {/* Child Controls */}
        <div className="space-y-2 border p-4 rounded border-purple-500">
          <h2 className="text-lg font-bold text-purple-400">Child Controls</h2>
          <div>
            <label>Rotate: {childRotate}°</label>
            <input
              type="range"
              min="-180"
              max="180"
              value={childRotate}
              onChange={(e) => setChildRotate(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label>SkewX: {childSkewX}°</label>
            <input
              type="range"
              min="-50"
              max="50"
              value={childSkewX}
              onChange={(e) => setChildSkewX(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label>SkewY: {childSkewY}°</label>
            <input
              type="range"
              min="-50"
              max="50"
              value={childSkewY}
              onChange={(e) => setChildSkewY(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label>ScaleX: {childScaleX.toFixed(2)}</label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={childScaleX}
              onChange={(e) => setChildScaleX(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label>ScaleY: {childScaleY.toFixed(2)}</label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={childScaleY}
              onChange={(e) => setChildScaleY(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
        {/* Grandchild Controls */}
        <div className="space-y-2 border p-4 rounded border-green-500">
          <h2 className="text-lg font-bold text-green-400">
            Grandchild Controls
          </h2>
          <div>
            <label>Rotate: {grandchildRotate}°</label>
            <input
              type="range"
              min="-180"
              max="180"
              value={grandchildRotate}
              onChange={(e) => setGrandchildRotate(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label>SkewX: {grandchildSkewX}°</label>
            <input
              type="range"
              min="-50"
              max="50"
              value={grandchildSkewX}
              onChange={(e) => setGrandchildSkewX(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label>SkewY: {grandchildSkewY}°</label>
            <input
              type="range"
              min="-50"
              max="50"
              value={grandchildSkewY}
              onChange={(e) => setGrandchildSkewY(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label>ScaleX: {grandchildScaleX.toFixed(2)}</label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={grandchildScaleX}
              onChange={(e) => setGrandchildScaleX(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label>ScaleY: {grandchildScaleY.toFixed(2)}</label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={grandchildScaleY}
              onChange={(e) => setGrandchildScaleY(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full bg-gray-800"
        style={{ height: 600 }}
      >
        {parentCorners && childCorners && grandchildCorners && (
          <>
            {/* Parent Box */}
            <div
              className="absolute bg-blue-900/50 border-2 border-blue-500"
              style={{
                width: boxWidth,
                height: boxHeight,
                left: 0,
                top: 0,
                transform: parentMatrixCss,
                transformOrigin: "0 0",
              }}
            >
              <p className="p-2 text-white">Parent Box</p>
            </div>
            {/* Child Box */}
            <div
              className="absolute bg-purple-900/50 border-2 border-purple-500"
              style={{
                width: childWidth,
                height: childHeight,
                left: 0,
                top: 0,
                transform: childMatrixCss,
                transformOrigin: "0 0",
              }}
            >
              <p className="p-2 text-white">Child Box</p>
            </div>
            {/* Grandchild Box */}
            <div
              className="absolute bg-green-900/50 border-2 border-green-500"
              style={{
                width: grandchildWidth,
                height: grandchildHeight,
                left: 0,
                top: 0,
                transform: grandchildMatrixCss,
                transformOrigin: "0 0",
              }}
            >
              <p className="p-2 text-white">Grandchild Box</p>
            </div>

            {/* SVG Overlays */}
            <svg className="absolute left-0 top-0 w-full h-full pointer-events-none">
              {/* Parent Outline */}
              <polygon
                points={`
                  ${parentCorners.topLeft.x},${parentCorners.topLeft.y}
                  ${parentCorners.topRight.x},${parentCorners.topRight.y}
                  ${parentCorners.bottomRight.x},${parentCorners.bottomRight.y}
                  ${parentCorners.bottomLeft.x},${parentCorners.bottomLeft.y}
                `}
                fill="none"
                stroke="lime"
                strokeWidth={2}
                strokeDasharray="4,3"
              />
              {/* Child Outline */}
              <polygon
                points={`
                  ${childCorners.topLeft.x},${childCorners.topLeft.y}
                  ${childCorners.topRight.x},${childCorners.topRight.y}
                  ${childCorners.bottomRight.x},${childCorners.bottomRight.y}
                  ${childCorners.bottomLeft.x},${childCorners.bottomLeft.y}
                `}
                fill="none"
                stroke="yellow"
                strokeWidth={2}
                strokeDasharray="4,3"
              />
              {/* Grandchild Outline */}
              <polygon
                points={`
                  ${grandchildCorners.topLeft.x},${grandchildCorners.topLeft.y}
                  ${grandchildCorners.topRight.x},${grandchildCorners.topRight.y}
                  ${grandchildCorners.bottomRight.x},${grandchildCorners.bottomRight.y}
                  ${grandchildCorners.bottomLeft.x},${grandchildCorners.bottomLeft.y}
                `}
                fill="none"
                stroke="cyan"
                strokeWidth={2}
                strokeDasharray="4,3"
              />
            </svg>

            {/* Parent Handles */}
            {(
              ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const
            ).map((key) => {
              const pt = parentCorners[key];
              return (
                <div
                  key={`parent-${key}`}
                  className="absolute flex items-center justify-center rounded-full bg-white text-blue-600 border-2 border-blue-600"
                  style={{
                    width: 16,
                    height: 16,
                    left: pt.x,
                    top: pt.y,
                    transform: "translate(-50%,-50%)",
                    fontSize: 10,
                    pointerEvents: "none",
                  }}
                >
                  {key.substring(0, 2).toUpperCase()}
                </div>
              );
            })}
            {(["edgeTop", "edgeRight", "edgeBottom", "edgeLeft"] as const).map(
              (key) => {
                const pt = parentCorners[key];
                return (
                  <div
                    key={`parent-${key}`}
                    className="absolute flex items-center justify-center rounded-full bg-white text-green-600 border-2 border-green-600"
                    style={{
                      width: 16,
                      height: 16,
                      left: pt.x,
                      top: pt.y,
                      transform: "translate(-50%,-50%)",
                      fontSize: 10,
                      pointerEvents: "none",
                    }}
                  >
                    {key.substring(4, 5).toUpperCase()}
                  </div>
                );
              }
            )}
            {/* Child Handles */}
            {(
              ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const
            ).map((key) => {
              const pt = childCorners[key];
              return (
                <div
                  key={`child-${key}`}
                  className="absolute flex items-center justify-center rounded-full bg-white text-purple-600 border-2 border-purple-600"
                  style={{
                    width: 16,
                    height: 16,
                    left: pt.x,
                    top: pt.y,
                    transform: "translate(-50%,-50%)",
                    fontSize: 10,
                    pointerEvents: "none",
                  }}
                >
                  {key.substring(0, 2).toUpperCase()}
                </div>
              );
            })}
            {/* Grandchild Handles */}
            {(
              ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const
            ).map((key) => {
              const pt = grandchildCorners[key];
              return (
                <div
                  key={`grandchild-${key}`}
                  className="absolute flex items-center justify-center rounded-full bg-white text-green-300 border-2 border-green-300"
                  style={{
                    width: 16,
                    height: 16,
                    left: pt.x,
                    top: pt.y,
                    transform: "translate(-50%,-50%)",
                    fontSize: 10,
                    pointerEvents: "none",
                  }}
                >
                  {key.substring(0, 2).toUpperCase()}
                </div>
              );
            })}
            {(["edgeTop", "edgeRight", "edgeBottom", "edgeLeft"] as const).map(
              (key) => {
                const pt = grandchildCorners[key];
                return (
                  <div
                    key={`grandchild-${key}`}
                    className="absolute flex items-center justify-center rounded-full bg-white text-red-300 border-2 border-red-300"
                    style={{
                      width: 16,
                      height: 16,
                      left: pt.x,
                      top: pt.y,
                      transform: "translate(-50%,-50%)",
                      fontSize: 10,
                      pointerEvents: "none",
                    }}
                  >
                    {key.substring(4, 5).toUpperCase()}
                  </div>
                );
              }
            )}
          </>
        )}
      </div>

      <p className="mt-4 text-sm max-w-md">
        <strong>How it works:</strong> The parent's global matrix is computed
        first. The child's global matrix is obtained by multiplying the parent's
        matrix with the child's local matrix. The grandchild inherits both by
        multiplying the child's global matrix with its own local matrix. This
        recursive multiplication ensures that all transformations (rotation,
        skew, and scale) in the hierarchy are properly applied and aligned.
      </p>
    </main>
  );
}
