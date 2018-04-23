var price = 0;

$(function () {


    var url = '/card/import/upload';
    $('#fileupload').fileupload({
        url: url,
        dataType: 'json',

        submit: function (e, data) {
            if (price != '50' && price != '100' && price != '300') {
                alert('请先选择一种面值');
                return false;
            }

            data.formData = {'price': price};
        },

        change: function (e, data) {
            $.each(data.files, function (index, file) {
                $("#filename").text(file.name);
            });
        },

        done: function (e, data) {
            if (data.result['status'] == 'ok') {
                box_id = data.result['box_id'];
                alert('上传成功，编号' + box_id);
            } else {
                alert(data.result['msg']);
                $("#act_charge").text().attr('disabled', 'true');
            }
        },

        progressall: function (e, data) {
            var progress = parseInt(data.loaded / data.total * 100, 10);
        }
    });

    var func_set_price = function (e) {
        price = e.data;
        $("#price-group").find("a").removeClass("btn-danger");
        $(this).addClass("btn-danger").blur();
    };

    $("#btn-price-50").click("50", func_set_price);
    $("#btn-price-100").click("100", func_set_price);
    $("#btn-price-300").click("300", func_set_price);
});