'use strict';

describe('Operations', () => {
  var module,
      Operations;

  var id = 'id-01',
      category1 = 'c1',
      mockOperations = {
        'id-01': {
          'id': id,
          'category': category1,
          'value': 101
        },
        'id-02': {
          'id': 'id-02',
          'category': 'c2',
          'value': 102
        }
      },
      mockOperationsFull = {
        'id-01': {
          'id': id,
          'category': category1,
          'value': 101,
          'parameters': {
            'parameter': {
              'type': 'some'
            }
          }
        }
      },
      mockCatalog = {
        'catalog': [
          {
            'id': category1,
            'name': 'Category1',
            'items': [
              {
                'id': id
              }
            ],
            'catalog': [
              {
                'id': 'c1-1',
                'name': 'SubCategory1-1',
                'items': [
                  {
                    'id': 'id-01-01'
                  }
                ]
              }
            ]
          },
          {
            'id': 'c2',
            'name': 'Category2',
            'items': [
              {
                'id': 'id-02'
              }
            ]
          }
        ]
      };


  beforeEach(() => {
    module = angular.module('test', []);

    require('./../operations.factory.js').inject(module);

    angular.mock.module('test');
    angular.mock.module(($provide) => {
      $provide.constant('config', {
        'apiHost': '',
        'apiPort': ''
      });

      $provide.factory('OperationsApiClient', ($q) => {
        var requestSuccess = true;

        var requestAPI = (response) => {
          let deferred = $q.defer();
          if (requestSuccess) {
            deferred.resolve(response);
          } else {
            deferred.reject();
          }
          return deferred.promise;
        };

        return {
          get: (id) => requestAPI({
            'operation': mockOperationsFull[id]
          }),
          getAll: () => requestAPI({
            'operations': mockOperations
          }),
          getCatalog: () => requestAPI(mockCatalog),
          changeRequestState: (state) => {
            requestSuccess = state;
          }
        };
      });
    });
    angular.mock.inject((_Operations_) => {
      Operations = _Operations_;
    });
  });


  it('should be defined', () => {
    expect(Operations).toBeDefined();
    expect(Operations).toEqual(jasmine.any(Object));
  });

  it('should have defined methods', () => {
    expect(Operations.load).toEqual(jasmine.any(Function));
    expect(Operations.getData).toEqual(jasmine.any(Function));
    expect(Operations.get).toEqual(jasmine.any(Function));
    expect(Operations.getWithParams).toEqual(jasmine.any(Function));
    expect(Operations.hasWithParams).toEqual(jasmine.any(Function));
    expect(Operations.getCatalog).toEqual(jasmine.any(Function));
    expect(Operations.getCategory).toEqual(jasmine.any(Function));
  });


  describe('should have load method', () => {
    it('which return promise', () => {
      let promise = Operations.load();
      expect(promise).toEqual(jasmine.any(Object));
      expect(promise.then).toEqual(jasmine.any(Function));
      expect(promise.catch).toEqual(jasmine.any(Function));
    });

    it(
      'resolve promise on requests success',
      angular.mock.inject(($rootScope, OperationsApiClient) =>
    {
      let success = false,
          error   = false;

      OperationsApiClient.changeRequestState(true);

      Operations.load().then(() => {
        success = true;
      }, () => {
        error = true;
      });
      $rootScope.$apply();

      expect(success).toBe(true);
      expect(error).toBe(false);
    }));

    it(
      'request api only once / use cache for next initialization',
      angular.mock.inject(($rootScope, OperationsApiClient) =>
    {
      let success = false,
          error   = false;

      OperationsApiClient.changeRequestState(true);

      spyOn(OperationsApiClient, 'getAll').and.callThrough();
      spyOn(OperationsApiClient, 'getCatalog').and.callThrough();
      spyOn(Operations, 'load').and.callThrough();

      Operations.load().then(() => {
        success = true;
      }, () => {
        error = true;
      });
      $rootScope.$apply();

      expect(Operations.load).toHaveBeenCalled();
      expect(OperationsApiClient.getAll).toHaveBeenCalled();
      expect(OperationsApiClient.getCatalog).toHaveBeenCalled();
      expect(success).toBe(true);
      expect(error).toBe(false);

      success = false;
      error = false;

      Operations.load().then(() => {
        success = true;
      }, () => {
        error = true;
      });
      $rootScope.$apply();

      expect(Operations.load).toHaveBeenCalled();
      expect(Operations.load.calls.count()).toBe(2);
      expect(OperationsApiClient.getAll.calls.count()).toBe(1);
      expect(OperationsApiClient.getCatalog.calls.count()).toBe(1);
      expect(success).toBe(true);
      expect(error).toBe(false);
    }));

    it(
      'reject promise on api request error',
      angular.mock.inject(($rootScope, OperationsApiClient) =>
    {
      let success = false,
          error   = false;

      OperationsApiClient.changeRequestState(false);

      Operations.load().then(() => {
        success = true;
      }, () => {
        error = true;
      });
      $rootScope.$apply();

      expect(success).toBe(false);
      expect(error).toBe(true);
    }));
  });


  describe('returns proper data after load for', () => {
    beforeEach(angular.mock.inject(($rootScope, OperationsApiClient) => {
      OperationsApiClient.changeRequestState(true);
      Operations.load();
      $rootScope.$apply();
    }));

    it('catalog', angular.mock.inject(() => {
      expect(Operations.getCatalog()).toEqual(mockCatalog.catalog);
    }));

    it('known category', angular.mock.inject(() => {
      expect(Operations.getCategory(category1)).toEqual(mockCatalog.catalog[0]);
    }));

    it('unknown category', angular.mock.inject(() => {
      expect(Operations.getCategory('categoryX')).toBeNull();
    }));

    it('operation list', angular.mock.inject(() => {
      expect(Operations.getData()).toEqual(mockOperations);
    }));

    it('known operation', angular.mock.inject(() => {
      expect(Operations.get(id)).toEqual(mockOperations[id]);
    }));

    it('unknown operation', angular.mock.inject(() => {
      expect(Operations.get('id-X')).toBeNull();
    }));
  });


  describe('should have getWithParams method', () => {
    beforeEach(angular.mock.inject(($rootScope, OperationsApiClient) => {
      OperationsApiClient.changeRequestState(true);
      Operations.load();
      $rootScope.$apply();
    }));

    it('which return promise',
      angular.mock.inject(() =>
    {
      let promise = Operations.getWithParams(id);
      expect(promise).toEqual(jasmine.any(Object));
      expect(promise.then).toEqual(jasmine.any(Function));
      expect(promise.catch).toEqual(jasmine.any(Function));
    }));

    it(
      'resolve promise on requests success',
      angular.mock.inject(($rootScope, OperationsApiClient) =>
    {
      let success = false,
          error   = false,
          responseData;

      expect(Operations.get(id).parameters).not.toBeDefined();

      OperationsApiClient.changeRequestState(true);

      spyOn(OperationsApiClient, 'get').and.callThrough();

      expect(Operations.hasWithParams(id)).toBe(false);

      Operations.getWithParams(id).then((data) => {
        success = true;
        responseData = data;
      }, () => {
        error = true;
      });
      $rootScope.$apply();

      expect(OperationsApiClient.get).toHaveBeenCalled();
      expect(OperationsApiClient.get.calls.count()).toBe(1);
      expect(Operations.hasWithParams(id)).toBe(true);
      expect(success).toBe(true);
      expect(error).toBe(false);
      expect(responseData.parameters).toBeDefined();
      expect(responseData.parameters).toEqual(jasmine.any(Object));

      success = false;
      error = false;
      responseData = null;

      Operations.getWithParams(id).then((data) => {
        success = true;
        responseData = data;
      }, () => {
        error = true;
      });
      $rootScope.$apply();

      expect(OperationsApiClient.get.calls.count()).toBe(1);
      expect(success).toBe(true);
      expect(error).toBe(false);
      expect(responseData.parameters).toBeDefined();
      expect(responseData.parameters).toEqual(jasmine.any(Object));
    }));

  });

});
