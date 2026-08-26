# contracts/

Responsable: compartida — cambios solo por pull request revisado

El contrato entre todos los servicios: la API núcleo expone endpoints que se
describen aquí, y la salida del servicio NLU debe validar contra el esquema
de intenciones que también vive en esta carpeta. Ningún consumidor interno
debería divergir de lo que hay aquí; si algo cambia, cambia primero el
contrato y después el código que lo implementa.
