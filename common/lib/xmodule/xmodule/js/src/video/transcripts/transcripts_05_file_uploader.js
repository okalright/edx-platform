(function (window, undefined) {
    Transcripts.FileUploader = Backbone.View.extend({
        invisibleClass: 'is-invisible',
        validFileExtensions: ['srt'],

        events: {
            'change .file-input': 'changeHadler',
            'click .setting-upload': 'clickHandler'
        },

        uploadTpl: '#transcripts-file-upload',
        initialize: function () {
console.log('FileUploader::initialize');
            _.bindAll(this);

            this.file = false;
            this.render();
        },

        render: function () {
console.log('FileUploader::render');
            var tpl = $(this.uploadTpl).text(),
                tplContainer = this.$el.find('.transcripts-file-uploader');

            if (tplContainer) {
                if (!tpl) {
                    console.error('Couldn\'t load Transcripts File Upload template');
                }
                this.template = _.template(tpl);

                tplContainer.html(this.template({
                    ext: this.validFileExtensions,
                    component_id: this.options.component_id
                }));

                this.$statusBar = this.$el.find('.transcripts-message-status');
                this.$form = this.$el.find('.file-chooser');
                this.$input = this.$form.find('.file-input');
                this.$progress = this.$el.find('.progress-fill');
            }
        },

        upload: function () {
console.log('FileUploader::upload');
            if (!this.file) {
                return;
            }

            this.$form.ajaxSubmit({
                beforeSend: this.xhrResetProgressBar,
                uploadProgress: this.xhrProgressHandler,
                complete: this.xhrCompleteHandler
            });
        },

        clickHandler: function (event) {
console.log('FileUploader::clickHandler');
            event.preventDefault();

            this.$input
                .val(null)
                .trigger('click');
        },

        uploadHadler: function (event) {
console.log('FileUploader::uploadHadler');
            event.preventDefault();

            this.upload();
        },

        changeHadler: function (event) {
console.log('FileUploader::changeHadler');
            event.preventDefault();

            this.options.messenger.hideError();
            this.file = this.$input.get(0).files[0];

            if (this.checkExtValidity(this.file)) {
                this.upload();
            } else {
                this.options.messenger
                    .showError('Please select a file in .srt format.');
            }
        },

        checkExtValidity: function (file) {
console.log('FileUploader::checkExtValidity');
            var fileExtension = file.name
                                    .split('.')
                                    .pop()
                                    .toLowerCase();

            if ($.inArray(fileExtension, this.validFileExtensions) !== -1) {
                return true;
            }

            return false;
        },

        xhrResetProgressBar: function () {
console.log('FileUploader::xhrResetProgressBar');
            var percentVal = '0%';

            this.$progress
                .width(percentVal)
                .html(percentVal)
                .removeClass(this.invisibleClass);
        },

        xhrProgressHandler: function (event, position, total, percentComplete) {
console.log('FileUploader::xhrProgressHandler');
            var percentVal = percentComplete + '%';

            this.$progress
                .width(percentVal)
                .html(percentVal);
        },

        xhrCompleteHandler: function (xhr) {
console.log('FileUploader::xhrCompleteHandler');
            var utils = Transcripts.Utils,
                resp = JSON.parse(xhr.responseText),
                err = (resp.error) ? resp.error : 'Uploading failed.',
                videoId = resp.subs;

            this.$progress
                .addClass(this.invisibleClass);

            if (xhr.status === 200 && resp.status === "Success") {
                this.options.messenger.render('uploaded');
                utils.addToStorage('sub', videoId);
            } else {
                // TODO Retrieve error form server
                this.options.messenger.showError(err);
            }
        }
    });
}(this));
