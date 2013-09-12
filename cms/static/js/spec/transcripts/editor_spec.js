(function (window, undefined) {
    describe('Transcripts: editor', function () {
        it('check that MetadataCollection is available', function () {
            var models = [],
                mc = {};

            mc = new CMS.Models.MetadataCollection(models);

            expect(mc.models).toBeDefined();
            expect($.isArray(mc.models)).toBeTruthy();
            expect(mc.models.length).toBe(0);
        });

        it('check that Transcripts.Editor is available', function () {
            expect(Transcripts).toBeDefined();
            expect(Transcripts.Editor).toBeDefined();
        });
    });
}(window));
