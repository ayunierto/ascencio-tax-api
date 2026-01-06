const axios = require('axios');

let data = JSON.stringify({
  name: 'asd',
  legalName: 'asdasd',
  businessNumber: '123456789as1234',
  payrollAccountNumber: '12312312312',
  address: 'asdasdasda',
  city: 'asdasdasd',
  province: 'asdasdasd',
  postalCode: 'asdasdasdas',
  phone: 'asdasd',
  email: 'test@example.com',
});

let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'http://localhost:3000/api/v1/companies',
  headers: {
    'Content-Type': 'application/json',
    Authorization:
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijk2MzYwNWMwLWU3MzYtNDhiYy05YjdjLTdlYzYyN2U3MTA2YyIsImVtYWlsIjoiYXl1bmllcnRvQGdtYWlsLmNvbSIsImlhdCI6MTc2NzMxODI3NywiZXhwIjoxNzY3NDA0Njc3fQ.MNUaux6f3zJJM2mBmiOQtU7OZ0BkiWPwg9IrW0upY14',
  },
  data: data,
};

console.log('Sending request to:', config.url);
console.log('Payload:', data);

axios
  .request(config)
  .then((response) => {
    console.log('\n✅ Success!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
  })
  .catch((error) => {
    console.log('\n❌ Error occurred');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('No response received from server');
      console.log('Error:', error.message);
    } else {
      console.log('Error:', error.message);
    }
  });
