library(plumber)
library(rvest)
library(tidytext)
library(dplyr)
library(stringr)
library(mongolite)
library(jsonlite)
library(httr)
library(purrr)
library(tidymodels)
library(textrecipes)
library(urltools)
library(reticulate)

# Activar entorno virtual de Python
use_virtualenv("C:/Users/dylan/OneDrive/Documentos/Semestre8/No_Estructurados/detector_fake_news/r-reticulate", required = TRUE)

# Cargar modelo spaCy y Wikipedia
spacy <- import("spacy")
wikipedia <- import("wikipedia")
wikipedia$set_lang("es")
nlp <- spacy$load("es_core_news_sm")

# Modelo entrenado
modelo <- readRDS("modelo_entrenado.rds")
db <- mongo(collection = "noticias", db = "fake_news")

#* @apiTitle Fake News Detector API

#* CORS - permitir peticiones desde cualquier origen
#* @filter cors
function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  res$setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$status <- 200
    return("")
  }
  plumber::forward()
}

#* Analiza una URL y devuelve predicción
#* @param url
#* @get /analizar
function(url = "") {
  tryCatch({
    if (url == "") stop("URL vacía.")
    
    html <- read_html(url)
    titulo <- html %>% html_element("title") %>% html_text(trim = TRUE)
    texto <- html %>%
      html_elements("article p, main p, .nota p, .cuerpo p, .story p") %>%
      html_text2() %>%
      paste(collapse = " ") %>%
      str_squish()
    
    if (nchar(texto) < 150) {
      return(list(
        resultado = "indeterminado",
        resumen = "❗ El contenido de la noticia es demasiado corto para analizar con fiabilidad.",
        palabras_clave = character(0),
        relacionadas = list(),
        definiciones = list()
      ))
    }
    
    dominio <- urltools::domain(url) %>%
      str_remove("^www\\.") %>%
      tolower()
    
    datos <- tibble(text = as.character(texto), source = as.character(dominio))
    
    pred_raw <- as.character(predict(modelo, new_data = datos, type = "class")$.pred_class[1])
    pred_class <- ifelse(tolower(pred_raw) %in% c("true", "real"), "real",
                         ifelse(tolower(pred_raw) %in% c("false", "fake"), "fake", "indeterminado"))
    
    # Insertar solo si no existe
    if (db$count(paste0('{"url": "', url, '"}')) == 0) {
      db$insert(list(
        url = as.character(url),
        titulo = as.character(titulo),
        resultado = pred_class,
        fecha = Sys.time(),
        source = dominio
      ))
    }
    
    palabras <- tibble(text = texto) %>%
      unnest_tokens(word, text) %>%
      anti_join(get_stopwords("es"), by = "word") %>%
      count(word, sort = TRUE) %>%
      mutate(doc_id = 1) %>%
      bind_tf_idf(word, document = doc_id, n) %>%
      arrange(desc(tf_idf)) %>%
      slice_head(n = 5) %>%
      pull(word)
    
    query <- paste(palabras, collapse = " ")
    url_api <- paste0("https://newsapi.org/v2/everything?q=", URLencode(query),
                      "&language=es&pageSize=5&apiKey=a9a24a7190b64324a47bf5ac964968cf")
    
    res <- GET(url_api)
    
    noticias_relacionadas <- tryCatch({
      contenido <- content(res, as = "parsed", encoding = "UTF-8")
      if (!is.null(contenido$articles)) {
        lapply(contenido$articles, function(x) list(titulo = x$title, url = x$url))
      } else list()
    }, error = function(e) list())
    
    doc <- nlp$`__call__`(texto)
    entidades <- unique(tolower(sapply(doc$ents, function(e) e$text)))
    
    definiciones <- lapply(entidades, function(ent) {
      tryCatch({
        resumen <- wikipedia$summary(ent, sentences = 2L)
        list(entidad = ent, definicion = resumen)
      }, error = function(e) {
        list(entidad = ent, definicion = paste("Información no disponible para", ent))
      })
    })
    
    list(
      resultado = pred_class,
      resumen = paste(str_sub(texto, 1, 300), "..."),
      palabras_clave = palabras,
      relacionadas = noticias_relacionadas,
      definiciones = definiciones
    )
    
  }, error = function(e) {
    list(error = paste("Error al analizar la URL:", e$message))
  })
}

#* Fake vs Real por fuente
#* @get /stats/fake_vs_real_por_fuente
function() {
  datos <- db$find('{}', fields = '{"source": 1, "resultado": 1}')
  
  if (!is.data.frame(datos) || nrow(datos) == 0) {
    return(list(mensaje = "No hay datos disponibles."))
  }
  
  datos <- datos %>%
    mutate(
      source = as.character(source),
      resultado = tolower(as.character(resultado))
    ) %>%
    group_by(source) %>%
    summarise(
      fake = sum(resultado == "fake"),
      real = sum(resultado == "real")
    ) %>%
    ungroup() %>%
    mutate(total = fake + real) %>%
    arrange(desc(total))
  
  return(datos)
}

#* Noticias totales por fuente
#* @get /stats/noticias_por_fuente
function() {
  datos <- db$find('{}', fields = '{"source": 1, "resultado": 1}')
  
  if (!is.data.frame(datos) || nrow(datos) == 0) {
    return(list(mensaje = "No hay datos disponibles."))
  }
  
  datos <- datos %>%
    mutate(source = as.character(source)) %>%
    group_by(source) %>%
    summarise(total = n()) %>%
    arrange(desc(total))
  
  return(datos)
}

#* Tendencia diaria de fake vs real
#* @get /stats/tendencia_diaria
function() {
  datos <- db$find('{}', fields = '{"fecha": 1, "resultado": 1}')
  
  if (!is.data.frame(datos) || nrow(datos) == 0) {
    return(list(mensaje = "No hay datos disponibles."))
  }
  
  datos <- datos %>%
    mutate(
      fecha = as.Date(substr(fecha, 1, 10)), # extraer solo la fecha (yyyy-mm-dd)
      resultado = tolower(as.character(resultado))
    ) %>%
    filter(resultado %in% c("fake", "real")) %>%
    group_by(fecha, resultado) %>%
    summarise(cantidad = n()) %>%
    ungroup()
  
  return(datos)
}

