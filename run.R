install.packages(c("plumber", "rvest", "tidytext", "dplyr", "stringr", "mongolite", "jsonlite", "httr", "purrr", "tidymodels", "textrecipes", "urltools", "reticulate"))
install.packages("stopwords")
install.packages("ranger")



ruta <- "C:/Users/dylan/OneDrive/Documentos/Semestre8/No_Estructurados/detector_fake_news"
setwd(ruta)

library(reticulate)
use_python("C:/Users/dylan/AppData/Local/Programs/Python/Python311/python.exe", required = TRUE)

library(plumber)
library(stopwords)
library(ranger)
r <- plumb("api.R")
r$run(port=8000)