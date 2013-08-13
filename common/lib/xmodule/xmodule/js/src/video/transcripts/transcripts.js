(function(){

    window.Transcripts = window.Transcripts || {};

    window.Transcripts = Backbone.View.extend({

        tagName: "div",

        initialize: function() {
            var metadata = this.$el.data('metadata'),
                models = this.toModels(metadata);

            this.collection = new CMS.Models.MetadataCollection(models);

            this.metadataEditor = new CMS.Views.Metadata.Editor({
                el: this.$el,
                collection: this.collection
            })

        },

        render: function() {
        },

        // Convert metadata JSON to List of models
        toModels: function(data){
            var metadata = (_.isString(data)) ? parseJSON(data) : data,
                models = [];

            for (model in metadata){
                if (metadata.hasOwnProperty(model)) {
                    models.push(metadata[model]);
                }
            }

            return models;
        }

    });


}(this));