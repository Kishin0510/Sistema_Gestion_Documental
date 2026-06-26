module.exports = process.env.STORAGE === 's3'
  ? require('./s3.adapter')
  : require('./local.adapter')