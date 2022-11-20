import { eventFunction } from '../src'

type ColumnValues = {
  name: string
}

export default eventFunction<ColumnValues>('INSERT', (req) => {
  console.log(req.body.created_at)
  console.log(req.body.table.name, req.body.table.schema)
  console.log(req.body.event.data.new) // is typed as ColumnValues
  console.log(req.body.event.data.old) // is typed as null as it is an INSERT
})
