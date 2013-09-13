(function (window, undefined) {
    Transcripts.MessageManager = Backbone.View.extend({
        tagName: 'div',
        elClass: '.wrapper-transcripts-message',
        invisibleClass: 'is-invisible',

        events: {
            'click .setting-import': 'importHandler',
            'click .setting-replace': 'replaceHandler',
            'click .setting-choose': 'chooseHandler',
            'click .setting-use-existing': 'useExistingHandler'
        },

        templates: {
            not_found: '#transcripts-not-found',
            found: '#transcripts-found',
            import: '#transcripts-import',
            replace:  '#transcripts-replace',
            uploaded:  '#transcripts-uploaded',
            use_existing: '#transcripts-use-existing',
            choose: '#transcripts-choose'
        },

        initialize: function () {
            _.bindAll(this);

            this.fileUploader = new Transcripts.FileUploader({
                el: this.$el,
                messenger: this,
                component_id: this.options.component_id
            });
        },

        render: function (template_id, params) {
            var tplHtml = $(this.templates[template_id]).text(),
                videoList = this.options.parent.getVideoObjectsList(),
                groupedList = _.groupBy(
                    videoList,
                    function (value) {
                        return value.video;
                    }
                ),
                html5List = (params) ? params.html5_local : [],
                isYoutubeMode = params && params.is_youtube_mode,
                template;

            if (!tplHtml) {
                console.error('Couldn\'t load Transcripts status template');
            }

            template = _.template(tplHtml);
            this.$el
                .removeClass('is-invisible')
                .find(this.elClass).html(template({
                    component_id: encodeURIComponent(this.options.component_id),
                    html5_list: html5List,
                    grouped_list: groupedList,
                    isYoutubeMode: isYoutubeMode
                }));

            this.fileUploader.render();

            return this;
        },

        showError: function (err, hideButtons) {
console.log('[MessageManager::showError]');
            var $error = this.$el.find('.transcripts-error-message');

            if (err) {
                // Hide any other error messages.
                this.hideError();

                $error
                    .html(gettext(err))
                    .removeClass(this.invisibleClass);

                if (hideButtons) {
                    this.$el.find('.wrapper-transcripts-buttons')
                        .addClass(this.invisibleClass);
                }
            }
        },

        hideError: function () {
console.log('[MessageManager::hideError]');
            this.$el.find('.transcripts-error-message')
                .addClass(this.invisibleClass);

            this.$el.find('.wrapper-transcripts-buttons')
                .removeClass(this.invisibleClass);
        },

        importHandler: function (event) {
console.log('[MessageManager::importHandler]');
            event.preventDefault();

            this.importTranscripts();
        },

        importTranscripts: function () {
console.log('[MessageManager::importTranscripts]');
            var self = this,
                utils = Transcripts.Utils,
                component_id = this.options.component_id,
                parent = this.options.parent,
                videoList = parent.getVideoObjectsList();
            
            utils.command('replace', component_id, videoList)
                .done(function (resp) {
console.log('[MessageManager::importTranscripts: done]');
                    var utils = Transcripts.Utils,
                        videoId = resp.status.subs;

                    self.render('found');
                    utils.addToStorage('subs', videoId);
                })
                .fail(function (resp) {
console.log('[MessageManager::importTranscripts: fail]');
                    self.showError('Error: Import failed.');
                });
        },

        replaceHandler: function (event) {
console.log('[MessageManager::replaceHandler]');
            event.preventDefault();

            this.replaceTranscripts();
        },

        replaceTranscripts: function () {
console.log('[MessageManager::replaceTranscripts]');
            var self = this,
                utils = Transcripts.Utils,
                component_id = this.options.component_id,
                videoList = this.options.parent.getVideoObjectsList();

            utils.command('replace', component_id, videoList)
                .done(function (resp) {
console.log('[MessageManager::replaceTranscripts: done]');
                    // TODO: update subs field

                    self.render('replaced');
                })
                .fail(function (resp) {
console.log('[MessageManager::replaceTranscripts: fail]');
                    self.showError('Error: Replacing failed.');
                });
        },

        useExistingHandler: function (event) {
console.log('[MessageManager::useExistingHandler]');
            event.preventDefault();

            this.useExistingTranscripts();
        },

        useExistingTranscripts: function () {
            // TODO
        }

    });
}(this));
