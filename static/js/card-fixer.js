$(function () {


    var url = '/card/fixer/upload';
    $('#fileupload').fileupload({
        url: url,
        dataType: 'json',

        submit: function (e, data) {
            var card_id = $('#ipt-card-id').val();
            var lines = $('#ipt-lines').val();

            data.formData = {'card_id': card_id, 'lines': lines};
        },

        change: function (e, data) {
            $.each(data.files, function (index, file) {
                $("#filename").text(file.name);
            });
        },

        done: function (e, data) {
            if (data.result.status == 'ok') {
                alert(data);
            }
        },

        progressall: function (e, data) {
            var progress = parseInt(data.loaded / data.total * 100, 10);
        }
    });
});