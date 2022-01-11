const should = require('should');
const rules  = require('../lib/broker/rules');

describe('Broker rules', () => {

  it('should return a rule object', () => {
    const rulesInstance = rules([]);
    should(rulesInstance).be.an.Object();
    should(rulesInstance.isAllowed).be.a.Function();
    should(rulesInstance._rules).be.an.Object();
    should(rulesInstance._cache).be.an.Object();
  });

  it('should instanciate read rules (queue/*)', () => {
    const rulesInstance = rules([{
      client : 'client-1',
      read   : ['queue/*']
    }]);

    let channel = {
      endpoint : 'queue',
      version  : '*',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue-other',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(true);
  });

  it('should instanciate read rules (queue/version) & multiple clients with * in clients', () => {
    const rulesInstance = rules([
      {
        client : 'client-*',
        read   : ['queue/v1/*']
      },
      {
        client : 'other',
        read   : ['queue/*']
      }
    ]);

    let channel = {
      endpoint : 'queue',
      version  : '*',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue-other',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(false);
  });

  it('should instanciate read rules (queue/version/*) & multiple clients with * in clients', () => {
    const rulesInstance = rules([
      {
        client : 'client-*',
        read   : ['queue/v1/1']
      },
      {
        client : 'other-with-version',
        read   : ['queue/v1/*']
      },
      {
        client : 'other',
        read   : ['queue/*']
      }
    ]);

    let channel = {
      endpoint : 'queue',
      version  : '*',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '2'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue-other',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(false);
  });

  it('should instanciate read rules (queue/version/id) & multiple clients with * in clients', () => {
    const rulesInstance = rules([
      {
        client : 'client-1',
        read   : ['queue/v1/1']
      },
      {
        client : 'other-with-version',
        read   : ['queue/v1/*']
      },
      {
        client : 'other',
        read   : ['queue/*']
      }
    ]);

    let channel = {
      endpoint : 'queue',
      version  : '*',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '2'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(true);

    channel = {
      endpoint : 'queue-other',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true)).eql(true);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, true)).eql(false);
    should(rulesInstance.isAllowed('other', '123456789', channel, true)).eql(false);
  });

  it('should instanciate read rules (!queue/*)', () => {
    const rulesInstance = rules([{
      client : 'client-*',
      read   : ['!queue/v1/*']
    }]);

    let channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true, { ids : { 1 : {} } })).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true, { ids : { 1 : {} } })).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true, { ids : {} })).eql(true);
    should(rulesInstance.isAllowed('client-1', '123456789', channel, true, { ids : { 1 : {}} })).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true, { ids : { 1 : {}} })).eql(false);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '10'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true, { ids : {} })).eql(true);
    should(rulesInstance.isAllowed('client-1', '123456789', channel, true, { ids : { 10 : {}} })).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true, { ids : { 10 : {}} })).eql(false);
  });

  it('should instanciate read rules (!queue/*) multiple ids', () => {
    const rulesInstance = rules([{
      client : 'client-*',
      read   : ['!queue/v1/*']
    }]);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : ['1', '2']
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, true, { ids : {} })).eql(true);
    should(rulesInstance.isAllowed('client-1', '123456789', channel, true, { ids : { 1 : {}} })).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true, { ids : { 3 : {}, 4 : {}} })).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, true, { ids : { 1 : {}, 2 : {}} })).eql(false);
  });

  it('should instanciate write rules (queue/*)', () => {
    const rulesInstance = rules([{
      client : 'client-1',
      write  : ['queue/*']
    }]);

    let channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue-other',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);
  });

  it('should instanciate write rules (queue/*) & multiple clients', () => {
    const rulesInstance = rules([
      {
        client : 'client-1',
        write  : ['queue/*']
      },
      {
        client : 'client-2',
        write  : ['queue/*']
      }
    ]);

    let channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue-other',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(false);
  });

  it('should instanciate write rules (queue/*) & multiple clients with * in clients', () => {
    const rulesInstance = rules([
      {
        client : 'client-*',
        write  : ['queue/*']
      },
      {
        client : 'other',
        write  : ['queue/*']
      }
    ]);

    let channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue-other',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(false);
  });

  it('should instanciate write rules (queue/version) & multiple clients with * in clients', () => {
    const rulesInstance = rules([
      {
        client : 'client-*',
        write  : ['queue/v1/*']
      },
      {
        client : 'other',
        write  : ['queue/*']
      }
    ]);

    let channel = {
      endpoint : 'queue',
      version  : '*',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue-other',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(false);
  });

  it('should instanciate write rules (queue/version/*) & multiple clients with * in clients', () => {
    const rulesInstance = rules([
      {
        client : 'client-*',
        write  : ['queue/v1/1']
      },
      {
        client : 'other-with-version',
        write  : ['queue/v1/*']
      },
      {
        client : 'other',
        write  : ['queue/*']
      }
    ]);

    let channel = {
      endpoint : 'queue',
      version  : '*',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '2'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue-other',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(false);
  });

  it('should instanciate write rules (queue/version/id) & multiple clients with * in clients', () => {
    const rulesInstance = rules([
      {
        client : 'client-1',
        write  : ['queue/v1/1']
      },
      {
        client : 'other-with-version',
        write  : ['queue/v1/*']
      },
      {
        client : 'other',
        write  : ['queue/*']
      }
    ]);

    let channel = {
      endpoint : 'queue',
      version  : '*',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '*'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue',
      version  : 'v1',
      id       : '2'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(true);

    channel = {
      endpoint : 'queue-other',
      version  : 'v1',
      id       : '1'
    };

    should(rulesInstance.isAllowed('client-1', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('client-2', '123456789', channel, false)).eql(true);
    should(rulesInstance.isAllowed('other-with-version', '123456789', channel, false)).eql(false);
    should(rulesInstance.isAllowed('other', '123456789', channel, false)).eql(false);
  });

});
