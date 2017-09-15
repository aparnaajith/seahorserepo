'use strict';

/* @ngInject */
function WorkflowService($q, Workflow, OperationsHierarchyService, WorkflowsApiClient, Operations, $rootScope,
  DefaultInnerWorkflowGenerator, debounce, nodeTypes) {

  // TODO Disable clean/export/run in inner workflows
  // TODO Prevent deleting Sink and Source

  const INNER_WORKFLOW_PARAM_NAME = 'inner workflow';

  class WorkflowServiceClass {

    constructor() {
      this._workflowsStack = [];
      this._innerWorkflowByNodeId = {};
      // We want to save workflow after all intermediate changes are resolved. Intermediate state might be invalid.
      // Debounce takes care of that and additionally reduces unnecessary client-server communication.
      // Example:
      // Inner workflow has nodes and publicParam list. Public params point at specific nodes.
      // Let's say we are removing node with public params. This change gets propagated to publicParam list next
      // digest cycle. For one digest cycle state is invalid - public params list points non-existing node.
      this._saveWorkflow = debounce((serializedWorkflow) => {
        console.log('Saving workflow after change...', serializedWorkflow);
        WorkflowsApiClient.updateWorkflow(serializedWorkflow);
      }, 200);
    }

    init() {
      this.downloadWorkflows();
    }

    downloadWorkflows() {
      this._isLoading = true;
      var deferred = $q.defer();
      WorkflowsApiClient.getAllWorkflows().then((data) => {
        this._workflowsData = data;
        this._isLoading = false;
        return deferred.resolve(data);
      }, (failure) => {
        this._isLoading = false;
        return deferred.reject(failure);
      });
      return deferred.promise;
    }

    initRootWorkflow(workflowData) {
      this._workflowsStack = [];
      let workflow = this._deserializeWorkflow(workflowData);
      workflow.workflowType = 'root';
      workflow.workflowStatus = 'editor';

      let nodes = _.values(workflow.getNodes());
      nodes.filter((n) => n.operationId === nodeTypes.CUSTOM_TRANSFORMER)
        .forEach((node) => this.initInnerWorkflow(node));

      $rootScope.$watch(() => workflow.serialize(), this._saveWorkflow, true);
      this._watchForNewCustomTransformers(workflow);
      this._workflowsStack.push(workflow);
    }

    // TODO Add enums for workflowType, workflowStatus
    initInnerWorkflow(node) {
      let innerWorkflowData = node.parametersValues[INNER_WORKFLOW_PARAM_NAME];
      let innerWorkflow = this._deserializeInnerWorkflow(innerWorkflowData);
      innerWorkflow.workflowType = 'inner';
      innerWorkflow.workflowStatus = 'editor';
      innerWorkflow.publicParams = innerWorkflow.publicParams || [];
      this._innerWorkflowByNodeId[node.id] = innerWorkflow;

      let nestedCustomTransformerNodes = _.filter(_.values(innerWorkflow.getNodes()), (n) => n.operationId === nodeTypes.CUSTOM_TRANSFORMER);
      _.forEach(nestedCustomTransformerNodes, (node) => this.initInnerWorkflow(node));

      $rootScope.$watch(() => this._serializeInnerWorkflow(innerWorkflow), (newVal) => {
        node.parametersValues = node.parametersValues || {};
        node.parametersValues[INNER_WORKFLOW_PARAM_NAME] = newVal;
      }, true);

      this._watchForNewCustomTransformers(innerWorkflow);
    }

    _watchForNewCustomTransformers(workflow) {
      $rootScope.$watchCollection(() => workflow.getNodes(), (newNodes, oldNodes) => {
        let addedNodeIds = _.difference(_.keys(newNodes), _.keys(oldNodes));
        let addedNodes = _.map(addedNodeIds, nodeId => newNodes[nodeId]);
        let addedCustomWorkflowNodes = _.filter(addedNodes, (n) => n.operationId === nodeTypes.CUSTOM_TRANSFORMER);
        _.forEach(addedCustomWorkflowNodes, (addedNode) => {
          if (_.isUndefined(addedNode.parametersValues[INNER_WORKFLOW_PARAM_NAME])) {
            addedNode.parametersValues[INNER_WORKFLOW_PARAM_NAME] = DefaultInnerWorkflowGenerator.create();
          }
          this.initInnerWorkflow(addedNode);
        });
      });
    }

    _getAllWorkflows() {
      const innerWorkflows = _.values(this._innerWorkflowByNodeId);
      return [this.getRootWorkflow()].concat(innerWorkflows);
    }

    _serializeInnerWorkflow(workflow) {
      let workflowData = workflow.serialize();
      workflowData.publicParams = workflow.publicParams;
      return workflowData;
    }

    _deserializeInnerWorkflow(workflowData) {
      let workflow = this._deserializeWorkflow(workflowData);
      workflow.publicParams = workflowData.publicParams || [];
      return workflow;
    }

    _deserializeWorkflow(workflowData) {
      let operations = Operations.getData();
      let workflow = new Workflow();
      let thirdPartyData = workflowData.thirdPartyData || {};
      workflow.id = workflowData.id;
      workflow.name = (thirdPartyData.gui || {}).name;
      workflow.description = (thirdPartyData.gui || {}).description;
      workflow.predefColors = (thirdPartyData.gui || {}).predefColors || workflow.predefColors;
      workflow.createNodes(workflowData.workflow.nodes, operations, workflowData.thirdPartyData);
      workflow.createEdges(workflowData.workflow.connections);
      workflow.updateEdgesStates(OperationsHierarchyService);
      return workflow;
    }

    isWorkflowRunning() {
      let statuses = _.chain(this.getCurrentWorkflow().getNodes())
        .map((node) => {
          return node.state;
        })
        .map((state) => {
          return state.status;
        })
        .value();
      let idx = _.findIndex(statuses, (status) => {
        return status === 'status_queued' || status === 'status_running';
      });

      return idx !== -1;
    }

    isWorkflowLoading () {
      return this._isLoading;
    }

    getCurrentWorkflow() {
      return _.last(this._workflowsStack);
    }

    onInferredState(states) {
      this._getAllWorkflows().forEach(w => w.updateState(states));
    }

    clearGraph() {
      this.getCurrentWorkflow().clearGraph();
    }

    updateTypeKnowledge(knowledge) {
      this._getAllWorkflows().forEach(w => w.updateTypeKnowledge(knowledge));
    }

    updateEdgesStates() {
      this.getCurrentWorkflow().updateEdgesStates(OperationsHierarchyService);
    }

    getAllWorkflows() {
      return this._workflowsData;
    }

    getRootWorkflow() {
      return this._workflowsStack[0];
    }

    removeWorkflowFromList(workflowId) {
      let foundWorkflow = this._workflowsData.find((workflow) => workflow.id === workflowId);
      let workflowIndex = this._workflowsData.indexOf(foundWorkflow);
      if (workflowIndex >= 0) {
        this._workflowsData.splice(workflowIndex, 1);
      }
    }

    deleteWorkflow(workflowId) {
      WorkflowsApiClient.deleteWorkflow(workflowId).then(() => {
        this.removeWorkflowFromList(workflowId);
      });
    }

  }

  return new WorkflowServiceClass();
}

exports.function = WorkflowService;

exports.inject = function(module) {
  module.factory('WorkflowService', WorkflowService);
};
