import React from 'react';

export default function ChinaFlag({ width = 40, height = 30 }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 60 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Red background */}
      <rect width="60" height="40" fill="#DE2910" />
      
      {/* Large yellow star */}
      <g fill="#FFDE00">
        <path
          d="M 10,8 L 11.5,12.5 L 16,12.5 L 12.5,15 L 14,19.5 L 10,17 L 6,19.5 L 7.5,15 L 4,12.5 L 8.5,12.5 Z"
        />
        
        {/* Small stars */}
        <path
          d="M 20,5 L 20.5,6.5 L 22,6.5 L 21,7.5 L 21.5,9 L 20,8 L 18.5,9 L 19,7.5 L 18,6.5 L 19.5,6.5 Z"
        />
        <path
          d="M 23,9 L 23.5,10.5 L 25,10.5 L 24,11.5 L 24.5,13 L 23,12 L 21.5,13 L 22,11.5 L 21,10.5 L 22.5,10.5 Z"
        />
        <path
          d="M 23,14 L 23.5,15.5 L 25,15.5 L 24,16.5 L 24.5,18 L 23,17 L 21.5,18 L 22,16.5 L 21,15.5 L 22.5,15.5 Z"
        />
        <path
          d="M 20,18 L 20.5,19.5 L 22,19.5 L 21,20.5 L 21.5,22 L 20,21 L 18.5,22 L 19,20.5 L 18,19.5 L 19.5,19.5 Z"
        />
      </g>
    </svg>
  );
}

