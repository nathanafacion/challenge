// Autora: Nathana Facion
// Objetivo: Desenvolver codigo que le um excel, valida e gera um json
// Bibliotecas
const parse = require('csv-parse')
var fs = require('fs');
var _ = require('lodash');
const jsonfile = require('jsonfile')

//Variaveis de arquivos
const file_name_input = 'input1.csv'
const file_name_output = 'output3.json'


// Validacao para dados boleanos
function validation_dataBoolean(data){
    if (data == 1 || data == 'yes'){
      return true;
    }
    return false;
}

function validation_group(data){
  //Validacao para os grupos
    var new_vector_group =[]
    for (i in data){
      if (data[i].trim()!=''){
        // Remove barra e virgula
        new_data = detected_more_data(data[i]);
        new_vector_group = _.concat(new_vector_group,new_data)
      }
    }
    return new_vector_group.map(function (str) { return str.trim(); });
}

// detecta a quantidade de dados caso tenha separador
// para transformar em vetor
function detected_more_data(data){
    return data.split(/[/,]+/);
}

// Cria cada um dos usuarios
function create_user(row){
  var user = {
   'fullname' : row.fullname,
   'eid'  : row.eid,
   'groups' : validation_group(row.group),
   'addresses' : create_address(row) ,
   'invisible' : validation_dataBoolean(row.invisible),
   'see_all' : validation_dataBoolean(row.see_all)
  }
   return user;
}

// Validacao dos dados de tag e type
function create_type_tags(data){
  //separa cada palavra em um item de uma lista
  var vector_type_tags = data.split(" ");
  // a primeira sera o tipo o resto sao as tags
  return  { 'type': vector_type_tags[0],'tags': _.drop(vector_type_tags) }

}

//
function validation_phone(data){
  try{
    // biblioteca para validar telefone
    var phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
    // caso o usuario use virgula ou barra em telefone também
    datas = detected_more_data(data);
    vector_phones_isValid = []
    for (i in datas){
        // se o telefone for valido removemos caracteres necessarios e adicionamos o 55
        // este numero representa o brasil mundialmente
        isValid = phoneUtil.isValidNumberForRegion(phoneUtil.parse(datas[i], 'BR'), 'BR');
        if(isValid){
          datas[i] = '55'+datas[i].replace(/\W/g, '').toString()
          vector_phones_isValid.push(true);
        }else{
          vector_phones_isValid.push(false);
        }
      }
      return {isValid:vector_phones_isValid, value:datas};
  } catch(e) {
      console.log("Log de erro, esse dado nao eh um telefone:")
      console.log(data);
      return {isValid:[false]};
  }
  return {isValid:[false]}
}

//verifica que tipo de email tem de aceitar
function validation_email(data){
  // Regex para verificar se eh padrao de email
  datas = detected_more_data(data);
  var regex_email = /\S+@\S+\.\S+/;
  var isValid = []
  for (i in datas){
    // Removendo qualquer possivel caracter especial do e-mail
    datas[i] = datas[i].replace(/[)(:!#$%&]/g, "").trim();
    if(regex_email.test(datas[i])){
      isValid.push(true);
    } else {
      isValid.push(false);
    }
  }
  return {isValid:isValid, value:datas};
}

//verifica que tipo de endereco o dado eh
function validation_address(key,data){
  //verifica se o dado veio vazio
  if(data == ''){
    return {isValid:[false]};
  }

  // se for do tipo email, verifica se eh um email correto
  if (key.includes("email")){
    return validation_email(data);
  }
  // se for do tipo phone, verifica se eh um phone correto
  if(key.includes("phone")){
    return validation_phone(data);
  }

  //caso nao seja nenhum desses, ignorar
  return {isValid:[false]};

}

function create_address(row){
    var vectorAddress = []
    for (var key in row){
      // Apenas as colunas que contem telefone ou email devem ser validadas
      var val_adress = validation_address(key,row[key]);
      // Valida se o e-mail ou telefone correspondem ao necessário
      var size = val_adress.isValid.length;
      for (i=0; i<size;i++){
        if (val_adress.isValid[i]){
          var type_tags = create_type_tags(key);
          var address = {
            'type':type_tags.type,
            'tags':type_tags.tags,
            'address': val_adress.value[i]
          }
          vectorAddress.push(address);
         }
      }
    }
   return vectorAddress;
}

function save_json(results){
    // formata e cria arquivo json
    jsonfile.writeFileSync(file_name_output, results, { spaces: 2 });
    console.log("Arquivo " + file_name_output + " foi gerado.")
}

function detect_duplicate(count_eid, results){
  var new_results = [];
  for (var id in count_eid){
    if (count_eid[id] != 1){
      // pegar os elementos duplicados
      duplicate_elements = _.filter(results, function(o) { return o.eid == id; })
      size = duplicate_elements.length-1;
      for (i=0; i<size; i++){
        // Concatenando os dois conjuntos e remove as repeticoes
        duplicate_elements[i+1].groups = _.uniq(_.concat(duplicate_elements[i].groups,duplicate_elements[i+1].groups));
        duplicate_elements[i+1].addresses = _.uniq(_.concat(duplicate_elements[i].addresses,duplicate_elements[i+1].addresses));

      }
      new_results.push(duplicate_elements[size]);
    }
  }
  return new_results;
}

//detecta id duplicado e une os usuarios
function union_user(results){
  // conta o numero de repeticao por eid
  count_eid = _.countBy(results, 'eid');
  //detected id duplicate
  new_results = detect_duplicate(count_eid, results);
  if (new_results.length == 0){
    return results;
  } else {
    filter_not_duplicate = _.filter(results, function(o) {
      return count_eid[o.eid] == 1
    });
    return _.concat(new_results,filter_not_duplicate);
  }

}
function mainIndex(){
  var results = [];
  // Leitura de arquivo
  fs.readFile(file_name_input,function (err,data) {
    if (err) {
      return console.log(err);
    }

    bufferString = data.toString();
    // Tirar duplicada de coluna grupo
    const parser = parse(bufferString,{
      columns: true,
      columns_duplicates_to_array: true
    })
    parser.on('readable', function() {
      let new_data
      while (new_data = parser.read()) {
        // cria cada um dos usuarios
        results.push(create_user(new_data));
      }
    })
    parser.on('end', function(){
      // junta usuarios duplicados
      final_results = union_user(results);
      // salva os dados
      save_json(final_results);
    })

  })

}

mainIndex();
