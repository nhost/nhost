import React from 'react'

export default function About(props) {
  return (
    <>
      <h1>About</h1>
      <p>{JSON.stringify(props, null, 2)}</p>
    </>
  )
}
