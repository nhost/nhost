/* eslint-disable */

import * as sdk from "hypertune";

const projectId = 2596;

const businessToken = `U2FsdGVkX19+V8BJnVR0xLEC+42OW5qZl/A0i6beAaRmJoIhFh5Yf6eIKBzLbV9h`;

const queryCode = `query InitQuery {
  root {
    enableServices
  }
}
`;

const query = {"Query":{"objectTypeName":"Query","selection":{"root":{"fieldArguments":{"__isPartialObject__":true},"fieldQuery":{"Root":{"objectTypeName":"Root","selection":{"enableServices":{"fieldArguments":{},"fieldQuery":null}}}}}}}};

const fallbackInitData: sdk.FallbackInitData & { [key: string]: unknown } = {"commitId":3297,"reducedExpression":{"id":"caxyeQqTKX3UGOXClvbnW","logs":{"events":{},"exposures":{},"evaluations":{}},"type":"ObjectExpression","fields":{"root":{"id":"PoMWxsy7KbW9fCq5XXvx4","body":{"id":"IUICRjZ7iSnh9k0cWBmnd","logs":{"events":{},"exposures":{},"evaluations":{}},"type":"ObjectExpression","fields":{"enableServices":{"id":"7WZWy2AIy_q9Vbz4cn9KB","logs":{"evaluations":{"XNOtHkUBpglrY1nkYa_bf":1},"events":{},"exposures":{}},"type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}}},"valueType":{"type":"ObjectValueType","objectTypeName":"Root"},"objectTypeName":"Root"},"logs":{"events":{},"exposures":{},"evaluations":{}},"type":"FunctionExpression","valueType":{"type":"FunctionValueType","returnValueType":{"type":"ObjectValueType","objectTypeName":"Root"},"parameterValueTypes":[{"type":"ObjectValueType","objectTypeName":"Query_root_args"}]},"parameters":[{"id":"Ygjhl2LqjiwcousTABFQz","name":"rootArgs"}]}},"metadata":{"permissions":{"user":{},"group":{"team":{"write":"allow"}}}},"valueType":{"type":"ObjectValueType","objectTypeName":"Query"},"objectTypeName":"Query"},"splits":{},"eventTypes":{},"commitConfig":{"splitConfig":{}},"initLogId":0,"commitHash":"4178461588049503","sdkConfig":{"hashPollInterval":1000,"flushLogsInterval":1000,"maxLogsPerFlush":1},"query":{"Query":{"objectTypeName":"Query","selection":{"root":{"fieldArguments":{"__isPartialObject__":true},"fieldQuery":{"Root":{"objectTypeName":"Root","selection":{"enableServices":{"fieldArguments":{},"fieldQuery":null}}}}}}}}};

export function initializeHypertune(
  variableValues: Rec,
  options: sdk.InitializeOptions = {}
): QueryNode {
  const defaultOptions = { businessToken, query, fallbackInitData };

  return sdk.initialize(
    QueryNode,
    projectId,
    queryCode,
    variableValues,
    { ...defaultOptions, ...options }
  );
}

// Enum types


  
// Input object types

export type Rec = {
      
      //
      };

export type Rec2 = {
      context: Rec3;
      //
      };

export type Rec3 = {
      workSpace: Rec4;
      //
      };

export type Rec4 = {
      id: string;
      //
      };
  
// Enum node classes


  
// Fragment node classes

export class QueryNode extends sdk.Node {
      typeName = "Query" as const;
  
      root(args: Rec2): RootNode {
          const props0 = this.getField("root", args);
          const expression0 = props0.expression;
  
          if (
      expression0 &&
      expression0.type === "ObjectExpression"
      && expression0.objectTypeName === "Root"
    ) {
      return new RootNode(props0);
    }
  
    const node = new RootNode(props0);
    node._logUnexpectedTypeError();
    return node;
      }
      }

export class RootNode extends sdk.Node {
      typeName = "Root" as const;
  
      enableServices(args: Rec): sdk.BooleanNode {
          const props0 = this.getField("enableServices", args);
          const expression0 = props0.expression;
  
          if (
      expression0 &&
      expression0.type === "BooleanExpression"
      
    ) {
      return new sdk.BooleanNode(props0);
    }
  
    const node = new sdk.BooleanNode(props0);
    node._logUnexpectedTypeError();
    return node;
      }
      }