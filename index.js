var app = require('./shortly.js');

//changed port from 4568 --> 4567
app.listen(4567, function() {
  console.log('Shortly is listening on 4567');
});
