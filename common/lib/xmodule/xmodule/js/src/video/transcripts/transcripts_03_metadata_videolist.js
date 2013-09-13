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
            CMS.Views.Metadata.AbstractEditor.prototype.render
                .apply(this, arguments);
                
            var self = this,
                utils = Transcripts.Utils,
                component_id =  this.$el.closest('.component').data('id'),
                videoList = this.getVideoObjectsList();

            utils.command('check', component_id, videoList)
                .done(function (resp) {
                    var params = resp.status,
                        mode = (videoList.length) ? videoList[0].mode : false;

                    if (videoList.length > 1 || mode === 'html5') {
                        self.openAdditional();
                    } else {
                        self.closeAdditional();
                    }

                    self.messenger.render(resp.command, params);
                    self.checkIsUniqVideoTypes();
                });
        },

        getValueFromEditor: function () {
            return _.map(
                this.$el.find('.input'),
                function (ele) {
                    return ele.value.trim();
                }
            ).filter(_.identity);
        },

        getVideoObjectsList: function () {
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
            var parseLink = Transcripts.Utils.parseLink,
                list = this.$el.find('.input'),
                val = value.filter(_.identity),
                placeholders = this.getPlaceholders(val);

            for (var i = 0; i < 3; i += 1) {
                list.eq(i)
                    .val(val[i] || null)
                    .attr('placeholder', placeholders[i]);
            }
        },

        getPlaceholders: function (value) {
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
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            this.$el.find('.videolist-additional').addClass('is-visible');
        },

        closeAdditional: function (event) {
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            this.$el.find('.videolist-additional').removeClass('is-visible');
        },

        toggleAdditional: function (event) {
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
            if (event && event.preventDefault) {
                event.preventDefault();
            }

            var entry = $(event.currentTarget).val(),
                data = Transcripts.Utils.parseLink(entry),
                isNotEmpty = Boolean(entry),
                $el = $(event.currentTarget);

            if (this.checkValidity(data, isNotEmpty)) {
                var fieldsValue = this.getValueFromEditor(),
                    modelValue = this.model.getValue();

                if (modelValue) {
                    modelValue = modelValue.filter(_.identity);
                }

                // When some correct value (change model) is adjusted, 
                // than change to incorrect (no changes to model), than 
                // back previous one correct value (that value is already 
                // in model). In this case Backbone doesn't trigger 'change'
                // event on model. That's why render method will not be invoked
                // and we should hide error here.
                if (_.isEqual(fieldsValue, modelValue)) {
                    this.messenger.hideError();
                } else {
                    this.updateModel();
                }
            } else if ($el.hasClass('videolist-url')) {
                this.closeAdditional();
            }
        },

        isUniqVideoTypes: function (videoList) {
            var arr = _.pluck(videoList, 'type'),
                uniqArr = _.uniq(arr);

            return arr.length === uniqArr.length;
        },

        checkIsUniqVideoTypes: function (videoList) {
            var videoList = videoList || this.getVideoObjectsList();

            if (!this.isUniqVideoTypes(videoList)) {
                this.messenger
                    .showError('Link types should be unique.', true);

                return false;
            }
        },

        checkValidity: function (data, showErrorModeMessage) {
            var self = this,
                utils = Transcripts.Utils,
                videoList = this.getVideoObjectsList();

            this.checkIsUniqVideoTypes(videoList);
                
            if (data.mode === 'incorrect' && showErrorModeMessage) {
                this.messenger
                    .showError('Incorrect url format.', true);

                return false;
            }

            return true;
        }
    });
}(this));
