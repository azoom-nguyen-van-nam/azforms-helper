import knex from 'knex'

const host = process.env.HOST
const port = process.env.PORT
const socketpath = process.env.SOCKET_PATH
const user = process.env.USER
const password = process.env.PASSWORD
const database = process.env.DATABASE
const mode = process.env.NODE_ENV


const connection = {
  user,
  password,
  database,
  charset: 'utf8',
  timezone: 'Asia/Tokyo',
  typeCast: function (field, next) {
    if (field.type === 'JSON') {
      return (JSON.parse(field.string()))
    }
    return next()
  }
}
if (mode === 'development') {
  connection.host = host
  connection.port = port
} else {
  connection.socketPath = socketpath
}

export default knex({
  client: 'mysql',
  connection
})
