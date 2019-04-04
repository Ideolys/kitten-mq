const LISTENER_TYPES = {
  LISTEN  : 0,
  CONSUME : 1
};

const ERRORS = {
  BAD_ENPOINT     : 'bad endpoint',
  BAD_ENPOINT_ALL : 'Bad endpoint, cannot be *',
  BAD_FORMAT      : 'Bad format',
  NOT_ALLOWED     : 'Not allowed'
};

exports.LISTENER_TYPES = LISTENER_TYPES;
exports.ERRORS         = ERRORS;
