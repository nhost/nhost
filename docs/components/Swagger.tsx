import SwaggerUI from 'swagger-ui-react'
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

export const Swagger: React.FC<{ spec: string }> = ({ spec }) => (
  <SwaggerUI
    url={`/openapi/${spec}`}
    plugins={[OperationsLayoutPlugin]}
    layout="OperationsLayout"
    supportedSubmitMethods={[]}
  />
)
