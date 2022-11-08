function Copy({ stroke = '#21324B', ...props }) {
  return (
    <svg fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M10.5 10.5h3v-8h-8v3"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 5.5h-8v8h8v-8z"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default Copy;
