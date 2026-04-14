export enum PortTypes {
  HTTP = 'http',
  TCP = 'tcp',
  UDP = 'udp',
  GRPC = 'grpc',
}

export function isPublishablePortType(type: PortTypes | string | undefined) {
  return type === PortTypes.HTTP || type === PortTypes.GRPC;
}
