import { parse } from 'graphql'
import { jsonToGraphQLQuery, VariableType } from 'json-to-graphql-query'
import {
  FieldDefinition,
  GenericSchema,
  getArgumentType,
  getConcreteType,
  getFieldType,
  getGraphQLType,
  getRootOperationNode,
  getTypeFromRef,
  OperationTypes,
  TypeRef
} from '../graphql-object/schema'

const toJson = (
  schema: GenericSchema,
  parameters: Record<string, any> | true = true,
  definition: TypeRef | FieldDefinition,
  variables: Record<string, any> = {},
  variablesValues: Record<string, any> = {},
  variablesPrefix: string = ''
) => {
  const select: Record<string, any> = {}
  const values = (parameters !== true && parameters.select) || {}
  const inputArguments = (parameters !== true && parameters.variables) || {}
  const args: Record<string, any> = {}

  const onValues = parameters !== true && parameters.on
  if (onValues) {
    select['__typename'] = true
    select['__on'] = Object.keys(onValues).map((fragmentName) => {
      const childVariablePrefix = variablesPrefix
        ? `${variablesPrefix}_on_${fragmentName}`
        : `on_${fragmentName}`
      const {
        query,
        variables: newVariables,
        variablesValues: newVariablesValues
      } = toJson(
        schema,
        onValues[fragmentName],
        getTypeFromRef(schema, { kind: 'OBJECT', name: fragmentName }),
        variables,
        variablesValues,
        childVariablePrefix
      )
      variables = { ...variables, ...newVariables }
      variablesValues = { ...variablesValues, ...newVariablesValues }
      return {
        __typeName: fragmentName,
        ...query
      }
    })
  }
  if ('type' in definition) {
    Object.keys(inputArguments).forEach((key) => {
      // ? camel case the variable names?
      const uniqueVariableName = variablesPrefix ? `${variablesPrefix}_${key}` : key
      variables[uniqueVariableName] = getGraphQLType(schema, getArgumentType(key, definition))
      args[key] = new VariableType(uniqueVariableName)
      variablesValues[key] = inputArguments[key]
    })
  }

  if (Object.keys(values).length === 0) {
    const fieldType = getConcreteType(schema, definition)
    if (fieldType.kind === 'OBJECT') {
      fieldType.fields?.forEach((field) => {
        const concreteType = getConcreteType(schema, field.type)
        if (concreteType.kind === 'SCALAR' || concreteType.kind === 'ENUM') {
          select[field.name] = true
        }
      })
    }
  } else {
    Object.entries(values).forEach(([key, value]: [string, any]) => {
      const childVariablePrefix = variablesPrefix ? `${variablesPrefix}_${key}` : key
      const fieldType = getFieldType(schema, key, definition)
      if (!fieldType) {
        throw new Error(`Field ${key} is not defined`)
      }
      const {
        query,
        variables: newVariables,
        variablesValues: newVariablesValues
      } = toJson(schema, value, fieldType, variables, variablesValues, childVariablePrefix)
      select[key] = query
      variables = { ...variables, ...newVariables }
      variablesValues = { ...variablesValues, ...newVariablesValues }
    })
  }

  return {
    query: { ...select, __args: args },
    variables,
    variablesValues
  }
}

export const toRawGraphQL = (
  schema: GenericSchema | undefined,
  opType: OperationTypes,
  rootOperation: string,
  params: any = {}
) => {
  if (!schema) throw new Error('Schema is not defined')
  const { query, variables, variablesValues } = toJson(
    schema,
    params,
    getRootOperationNode(schema, opType, rootOperation)
  )
  return {
    query: jsonToGraphQLQuery(
      {
        [opType.toLowerCase()]: {
          __variables: variables,
          [rootOperation]: query
        }
      },
      { pretty: true }
    ),
    variables: variablesValues
  }
}

export const toGraphQLDocument = (
  schema: GenericSchema | undefined,
  opType: OperationTypes,
  rootOperation: string,
  params: any
) => parse(toRawGraphQL(schema, opType, rootOperation, params).query)
