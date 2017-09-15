'use strict';

/* @ngInject */
function UploadWorkflowExecutionReportModalController(WorkflowsApiClient, $modalInstance, Upload) {
  const STATUS_PREPARING = 'preparing';
  const STATUS_LOADING = 'loading';
  const STATUS_SUCCESS = 'success';
  const STATUS_FAILURE = 'failure';

  _.assign(this, {
    status: STATUS_PREPARING,
    errorMessage: '',
    progress: '',
    close: () => {
      $modalInstance.dismiss();
    },
    upload: function (file) {
      this.status = STATUS_FAILURE;
      Upload.
        upload({
          url: WorkflowsApiClient.getUploadReportMethodUrl(),
          method: 'POST',
          file: file,
          fileFormDataName: 'workflowFile'
        }).
        progress((evt) => {
          this.status = STATUS_LOADING;
          this.progress = parseInt(100.0 * evt.loaded / evt.total);
        }).
        then((response) => {
          this.status = STATUS_SUCCESS;
          $modalInstance.close(response.data.executionReport.id);
        }).
        catch((error = {}) => {
          error.data = error.data || 'Server is not responding';
          this.status = STATUS_FAILURE;
          this.errorMessage = error.data;
        });
    },
    ok: function () {
      $modalInstance.close();
    }
  });
}

exports.inject = function (module) {
  module.controller('UploadWorkflowExecutionReportModalController', UploadWorkflowExecutionReportModalController);
};
