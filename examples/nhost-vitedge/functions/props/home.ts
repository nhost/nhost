import { EdgeProps } from 'vitedge'

export default <EdgeProps>{
  handler({ params = {}, query = {}, name = '' }) {
    return {
      data: {
        server: true,
        msg:
          'This is page ' +
          name.toUpperCase() +
          '. ' +
          process.env.VITEDGE_TEST,
      },
    }
  },
  options: {
    cache: {
      api: 90,
      html: 90,
    },
  },
}
