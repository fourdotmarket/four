import React from 'react';

export default function USFlag({ width = 40, height = 30 }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 60 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Red stripes */}
      <rect width="60" height="40" fill="#B22234" />
      <rect y="3.08" width="60" height="3.08" fill="white" />
      <rect y="9.23" width="60" height="3.08" fill="white" />
      <rect y="15.38" width="60" height="3.08" fill="white" />
      <rect y="21.54" width="60" height="3.08" fill="white" />
      <rect y="27.69" width="60" height="3.08" fill="white" />
      <rect y="33.85" width="60" height="3.08" fill="white" />
      
      {/* Blue canton */}
      <rect width="24" height="17.14" fill="#3C3B6E" />
      
      {/* White stars */}
      <g fill="white">
        {/* Row 1 - 6 stars */}
        <circle cx="2" cy="2" r="0.8" />
        <circle cx="6" cy="2" r="0.8" />
        <circle cx="10" cy="2" r="0.8" />
        <circle cx="14" cy="2" r="0.8" />
        <circle cx="18" cy="2" r="0.8" />
        <circle cx="22" cy="2" r="0.8" />
        
        {/* Row 2 - 5 stars */}
        <circle cx="4" cy="4.3" r="0.8" />
        <circle cx="8" cy="4.3" r="0.8" />
        <circle cx="12" cy="4.3" r="0.8" />
        <circle cx="16" cy="4.3" r="0.8" />
        <circle cx="20" cy="4.3" r="0.8" />
        
        {/* Row 3 - 6 stars */}
        <circle cx="2" cy="6.6" r="0.8" />
        <circle cx="6" cy="6.6" r="0.8" />
        <circle cx="10" cy="6.6" r="0.8" />
        <circle cx="14" cy="6.6" r="0.8" />
        <circle cx="18" cy="6.6" r="0.8" />
        <circle cx="22" cy="6.6" r="0.8" />
        
        {/* Row 4 - 5 stars */}
        <circle cx="4" cy="8.9" r="0.8" />
        <circle cx="8" cy="8.9" r="0.8" />
        <circle cx="12" cy="8.9" r="0.8" />
        <circle cx="16" cy="8.9" r="0.8" />
        <circle cx="20" cy="8.9" r="0.8" />
        
        {/* Row 5 - 6 stars */}
        <circle cx="2" cy="11.2" r="0.8" />
        <circle cx="6" cy="11.2" r="0.8" />
        <circle cx="10" cy="11.2" r="0.8" />
        <circle cx="14" cy="11.2" r="0.8" />
        <circle cx="18" cy="11.2" r="0.8" />
        <circle cx="22" cy="11.2" r="0.8" />
        
        {/* Row 6 - 5 stars */}
        <circle cx="4" cy="13.5" r="0.8" />
        <circle cx="8" cy="13.5" r="0.8" />
        <circle cx="12" cy="13.5" r="0.8" />
        <circle cx="16" cy="13.5" r="0.8" />
        <circle cx="20" cy="13.5" r="0.8" />
        
        {/* Row 7 - 6 stars */}
        <circle cx="2" cy="15.8" r="0.8" />
        <circle cx="6" cy="15.8" r="0.8" />
        <circle cx="10" cy="15.8" r="0.8" />
        <circle cx="14" cy="15.8" r="0.8" />
        <circle cx="18" cy="15.8" r="0.8" />
        <circle cx="22" cy="15.8" r="0.8" />
      </g>
    </svg>
  );
}

