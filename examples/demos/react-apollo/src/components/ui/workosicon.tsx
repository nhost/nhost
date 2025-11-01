type WorkOSIconProps = {
  width?: number;
  height?: number;
};

export function WorkOSIcon({ width = 20, height = 40 }: WorkOSIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 60 60"
      width={width}
      height={height}
    >
      <g transform="translate(-2, 2)">
        <path
          fill="#6363F1"
          d="M0,24c0,1.1,0.3,2.1,0.8,3l9.7,16.8c1,1.7,2.5,3.1,4.4,3.7c3.6,1.2,7.5-0.3,9.4-3.5l2.3-4.1
            l-9.2-16l9.8-16.9L29.5,3c0.7-1.2,1.6-2.2,2.7-3H17.2c-2.6,0-5.1,1.4-6.4,3.7L0.8,21C0.3,21.9,0,22.9,0,24z"
        />
        <path
          fill="#6363F1"
          d="M55.4,24c0-1.1-0.3-2.1-0.8-3l-9.8-17c-1.9-3.3-5.8-4.7-9.4-3.5c-1.9,0.6-3.4,2-4.4,3.7
            L28.7,8L38,24l-9.8,16.9L25.9,45c-0.7,1.2-1.6,2.2-2.7,3h15.1c2.6,0,5.1-1.4,6.4-3.7l10-17.3C55.1,26.1,55.4,25.1,55.4,24z"
        />
      </g>
    </svg>
  );
}
