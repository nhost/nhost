import {
  BaseActionObject,
  EventObject,
  ResolveTypegenMeta,
  ServiceMap,
  State,
  TypegenConstraint
} from 'xstate'
import { FileUploadContext, FileUploadEvents } from '../../src/machines'

export type GeneralState<
  Context,
  Events extends EventObject,
  Typegen extends TypegenConstraint
> = State<
  Context,
  Events,
  any,
  {
    value: any
    context: Context
  },
  ResolveTypegenMeta<Typegen, Events, BaseActionObject, ServiceMap>
>

export type GeneralFileUploadState<Typegen extends TypegenConstraint> = GeneralState<
  FileUploadContext,
  FileUploadEvents,
  Typegen
>
