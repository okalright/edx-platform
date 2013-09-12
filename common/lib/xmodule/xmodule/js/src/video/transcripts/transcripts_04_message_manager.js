(function (window, undefined) {
    Transcripts.MessageManager = Backbone.View.extend({
        tagName: 'div',
        elClass: '.wrapper-transcripts-message',
        invisibleClass: 'is-invisible',

        events: {
            'click .setting-import': importHandler,
            'click ': handler,
            'click ': handler,
            'click ': handler
        },

        templates: {
            not_found: '#transcripts-not-found',
            found: '#transcripts-found',
            import: '#transcripts-import',
            replace:  '#transcripts-replace',
            uploaded:  '#transcripts-uploaded',
            not_updated: '#transcripts-not-updated',
            choose: '#transcripts-choose'
        },

        initialize: function () {
            this.fileUploader = new Transcripts.FileUploader({
                el: this.$el,
                messanger: this,
                component_id: this.options.component_id
            });
        },

        render: function (template) {
            var tpl = $(this.templates[template]).text();

            if (!tpl) {
                console.error('Couldn\'t load Transcripts status template');
            }
            this.template = _.template(tpl);
            this.$el
                .removeClass('is-invisible')
                .find(this.elClass).html(this.template({
                    component_id: encodeURIComponent(this.options.component_id)
                }));

            this.fileUploader.render();

            return this;
        },

        showError: function (err, hideButtons) {
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
            this.$el.find('.transcripts-error-message')
                .addClass(this.invisibleClass);

            this.$el.find('.wrapper-transcripts-buttons')
                .removeClass(this.invisibleClass);
        },

        importHandler: function () {
            var utils = Transcripts.Utils,
                component_id = this.options.component_id,
                videoList = this.options.parent.getVideoObjectsList();
            //import
            utils.command('import', component_id, videoList)
                .done(callback)
                .fail(callback);
        }

    });
}(this));
