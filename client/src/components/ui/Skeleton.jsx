import React from "react";

export default function Skeleton({
  width = "100%",
  height = "100%",
  borderRadius = "4px",
  style = {},
}) {
  return (
    <div
      className="skeleton"
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

export function BinCardSkeleton() {
  return (
    <div className="bin-card skeleton-container" style={{ cursor: "default" }}>
      <div className="bin-card-header">
        <Skeleton width="44px" height="44px" borderRadius="10px" />
        <div className="bin-meta" style={{ flex: 1 }}>
          <Skeleton
            width="60%"
            height="20px"
            style={{ marginBottom: "8px", borderRadius: "4px" }}
          />
          <Skeleton width="40%" height="14px" borderRadius="4px" />
        </div>
      </div>
      <div className="compartments-row">
        <Skeleton width="100%" height="120px" borderRadius="12px" />
        <Skeleton width="100%" height="120px" borderRadius="12px" />
      </div>
      <div className="bin-card-footer" style={{ borderTop: "none" }}>
        <Skeleton width="100%" height="4px" borderRadius="100px" />
      </div>
    </div>
  );
}
