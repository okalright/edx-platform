(function (window, undefined) {
    CMS.Views.Metadata.VideoList = CMS.Views.Metadata.AbstractEditor.extend({

        events : {
            'click .setting-clear' : 'clear',
            'keypress .setting-input' : 'showClearButton',
            'click .collapse-setting' : 'toggleAdditional'
        },

        templateName: 'metadata-videolist-entry',
        placeholders: {
            'webm': '.webm',
            'mp4': 'http://somesite.com/video.mp4',
            'youtube': 'http://youtube.com/'
        },

        initialize: function () {
console.log('[VideoList::initialize]');
            CMS.Views.Metadata.AbstractEditor.prototype.initialize
                .apply(this, arguments);

            this.component_id = this.$el.closest('.component').data('id');

            this.$el.on(
                'input', 'input',
                _.debounce(_.bind(this.inputHandler, this), 300)
            );

            this.messenger = new Transcripts.MessageManager({
                el: this.$el.find('.transcripts-status'),
                component_id: this.component_id,
                parent: this
            });
        },

        render: function () {
console.log('[VideoList::render]');
            var self = this,
                utils = Transcripts.Utils,
                component_id =  this.$el.closest('.component').data('id'),
                videoList = this.getVideoObjectsList();

            CMS.Views.Metadata.AbstractEditor.prototype.render
                .apply(this, arguments);

            utils.command('check', component_id, videoList)
                .done(function (resp) {
console.log('[VideoList::render: done]');
                    var params = resp.status;

                    self.messenger.render(resp.command, params);
                })
                .fail(function (resp) {
console.log('[VideoList::render: fail]');
                    self.messenger.render('not_found');
                });
        },

        getValueFromEditor: function () {
console.log('[VideoList::getValueFromEditor]');
            return _.map(
                this.$el.find('.input'),
                function (ele) {
console.log('[VideoList::getValueFromEditor: map]');
                    return ele.value.trim();
                }
            ).filter(_.identity);
        },

        getVideoObjectsList: function () {
console.log('[VideoList::getVideoObjectsList]');
            var parseLink = Transcripts.Utils.parseLink,
                values = this.getValueFromEditor(),
                arr = [],
                data;

            for (var i = 0, len = values.length; i < len; i += 1) {
                data = parseLink(values[i]);

                if (data.mode !== 'incorrect') {
                    arr.push(data);
                }
            }

            return arr;
        },

        setValueInEditor: function (value) {
console.log('[VideoList::setValueInEditor]');
            var parseLink = Transcripts.Utils.parseLink,
                list = this.$el.find('.input'),
                val = value.filter(_.identity),
                placeholders = this.getPlaceholders(val);

            for (var i = 0; i < 3; i += 1) {
                list.eq(i)
                    .val(val[i] || null)
                    .attr('placeholder', placeholders[i]);
            }

            if (val.length > 1 || parseLink(val[0]).mode === 'html5') {
                this.openAdditional();
            } else {
                this.closeAdditional();
            }
        },

        getPlaceholders: function (value) {
console.log('[VideoList::getPlaceholders]');
            var parseLink = Transcripts.Utils.parseLink,
                placeholders = _.clone(this.placeholders),
                result = [],
                label, type;

            for (var i = 0; i < 3; i += 1) {
                type = parseLink(value[i]).type;

                if (placeholders[type]) {
                    label = placeholders[type];
                    delete placeholders[type];
                } else {
                    placeholders = _.values(placeholders);
                    label = placeholders.pop();
                }

                result.push(label);
            }

            return result;
        },

        openAdditional: function (event) {
console.log('[VideoList::openAdditional]');
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            this.$el.find('.videolist-additional').addClass('is-visible');
        },

        closeAdditional: function (event) {
console.log('[VideoList::closeAdditional]');
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            this.$el.find('.videolist-additional').removeClass('is-visible');
        },

        toggleAdditional: function (event) {
console.log('[VideoList::toggleAdditional]');
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            if (this.$el.find('.videolist-additional').hasClass('is-visible')) {
                this.closeAdditional.apply(this, arguments);
            } else {
                this.openAdditional.apply(this, arguments);
            }
        },

        inputHandler: function (event) {
console.log('[VideoList::inputHandler]');
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            var entry = $(event.currentTarget).val(),
                data = Transcripts.Utils.parseLink(entry),
                isNotEmpty = Boolean(entry),
                $el = $(event.currentTarget);

            if (this.checkValidity(data, isNotEmpty)) {
                this.updateModel();
            } else if ($el.hasClass('videolist-url')) {
                this.closeAdditional();
            }
        },

        isUniqVideoTypes: function (videoList) {
console.log('[VideoList::isUniqVideoTypes]');
            var arr = _.pluck(videoList, 'type'),
                uniqArr = _.uniq(arr);

            return arr.length === uniqArr.length;
        },

        checkValidity: function (data, showErrorModeMessage) {
console.log('[VideoList::checkValidity]');
            var self = this,
                utils = Transcripts.Utils,
                videoList = this.getVideoObjectsList();

            if (!this.isUniqVideoTypes(videoList)) {
                this.messenger
                    .showError('Link types should be unique.', true);

                return false;
            }

            if (data.mode === 'incorrect' && showErrorModeMessage) {
                this.messenger
                    .showError('Incorrect url format.', true);

                return false;
            }

            this.messenger.hideError();
            console.log(data)
            return true;
        }
    });
}(this));
