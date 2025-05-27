# entrenar_modelo.R

library(tidyverse)
library(tidymodels)
library(textrecipes)
library(readr)
library(stringr)

# Leer archivo en español
df <- read_csv("Noticias.csv", locale = locale(encoding = "Latin1")) %>%
  mutate(
    label = tolower(label),
    Source = str_to_lower(Source),
    Source = str_replace(Source, "^www\\.", ""),
    Source = str_trim(Source),
    label = factor(label)
  ) %>%
  select(text = Text, source = Source, label) %>%
  filter(label %in% c("fake", "true"))

# Estadísticas por fuente
estadisticas <- df %>%
  group_by(source) %>%
  summarise(
    total = n(),
    fake = sum(label == "fake"),
    true = sum(label == "true"),
    porcentaje_fake = round((fake / total) * 100, 2)
  ) %>%
  arrange(desc(porcentaje_fake))

write_csv(estadisticas, "estadisticas_fuentes.csv")

# División
set.seed(123)
data_split <- initial_split(df, prop = 0.8, strata = label)
train_data <- training(data_split)
test_data <- testing(data_split)

# Receta
receta <- recipe(label ~ text + source, data = train_data) %>%
  step_tokenize(text) %>%
  step_stopwords(text, language = "es") %>%
  step_tokenfilter(text, max_tokens = 1000) %>%
  step_tfidf(text) %>%
  step_string2factor(source) %>%
  step_unknown(source) %>%
  step_dummy(all_nominal_predictors())

receta_preparada <- prep(receta, training = train_data)

# Modelo
modelo <- rand_forest(mode = "classification", trees = 200) %>%
  set_engine("ranger")

modelo_final <- workflow() %>%
  add_recipe(receta) %>%
  add_model(modelo)

modelo_entrenado <- fit(modelo_final, data = train_data)

# Guardar archivos .rds
saveRDS(modelo_entrenado, "modelo_entrenado.rds")
saveRDS(receta_preparada, "receta_vectorizer.rds")
