import SwaggerUI from 'swagger-ui-react'
import React from 'react'
import 'swagger-ui-react/swagger-ui.css'

const OperationsLayout = (props) => {
  const { getComponent } = props
  const Operations = getComponent('operations', true)
  let SvgAssets = getComponent('SvgAssets')

  return (
    <div className="swagger-ui">
      <SvgAssets />
      <Operations />
    </div>
  )
}

const OperationsLayoutPlugin = () => ({
  components: {
    OperationsLayout
  }
})

type SwaggerProps = {
  /**
   * OpenAPI specification.
   */
  spec: string
}

export function Swagger({ spec }: SwaggerProps) {
  return (
    <SwaggerUI
      url={`/openapi/${spec}`}
      plugins={[OperationsLayoutPlugin]}
      layout="OperationsLayout"
      supportedSubmitMethods={[]}
    />
  )
}
