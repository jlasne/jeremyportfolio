# Découverte : état des lieux et plan d'amélioration

Date : 21/09/2026
Statut : réflexion en cours, rien de codé

---

## 1. Le constat

91% de l'argent d'un run part sur des profils qu'un filtre gratuit rejette.

Sur 1000 profils achetés :

| | |
|---|---|
| Jetés par l'étape 5, qui ne coûte rien | 970 |
| Argent dépensé pour eux | 2,23 $ |
| Part du coût total du run | 91% |

On achète 33 profils pour en garder 1, sans aucun moyen de savoir lequel avant de payer.

### Le coût par étape, mesuré

Base : 1000 comptes trouvés, 7 leads livrés, 2,46 $.

| # | étape | coût | part |
|---|---|---|---|
| 3 | Découverte | 2,300 $ | 93,4% |
| 4 | Calcul des performances | 0 $ | 0% |
| 5 | Survivants des performances | 0 $ | 0% |
| 6 | Collecte extra info | 0,032 $ | 1,3% |
| 7 | Deal breaker | 0,105 $ | 4,3% |
| 8 | Scoring brand fit | 0,025 $ | 1,0% |
| | Livraison | 0 $ | 0% |

La qualification coûte 0,16 $ quoi qu'il arrive. Elle ne bouge jamais avec le volume.

### Prix unitaires mesurés

| ce qu'on achète | prix |
|---|---|
| Un profil avec ses 12 posts | 0,0023 $ |
| Un jugement IA, images comprises | 0,0035 $ |
| Les commentaires d'un compte | 0,0046 $ |
| Une page Google (pipeline manuel) | 0,0018 $ |

### Où part le gâchis

| cause | perte sur 1000 |
|---|---|
| Trop peu d'abonnés | 621 |
| Vues ou cadence insuffisantes | 218 |
| Trop d'abonnés | 92 |

62% du gâchis tient à un seul critère : la taille. C'est le seul qu'on pourrait connaître avant de payer.

---

## 2. Ce que change un meilleur taux de visée

Le taux de visée est la part des profils achetés qui passent le filtre chiffré.

| taux | profils achetés | coût du run | par lead | part découverte |
|---|---|---|---|---|
| 3% (nous aujourd'hui) | 1000 | 2,46 $ | 0,35 $ | 93% |
| 10% | 300 | 0,85 $ | 0,12 $ | 81% |
| 24% (pipeline manuel) | 125 | 0,45 $ | 0,06 $ | 64% |
| 50% | 60 | 0,30 $ | 0,04 $ | 46% |
| 100% | 30 | 0,23 $ | 0,03 $ | 30% |

L'objectif de forme : que le gros du coût passe sur la qualification, pas sur la recherche. Ça arrive à partir de 50% de visée.

---

## 3. Taux de visée par canal, mesuré

| canal | dans la fenêtre d'abonnés | source |
|---|---|---|
| Google | 99 sur 100 | pipeline manuel |
| Voisins Apify | 68 sur 100 | pipeline manuel |
| Suggestions Instagram | 60 sur 100 | pipeline manuel |
| Mentions dans les légendes | 27 sur 100 | pipeline manuel |
| Recherche par nom de compte | 15 sur 100 | nous, mesuré aujourd'hui |

Notre canal unique est le pire de tous.

### Mesures complémentaires de nos runs

| recherche par nom de compte | nouveaux profils | médiane abonnés |
|---|---|---|
| Métiers : "comedian", "prankster" | 135 | 3 798 |
| Génériques : "comedy", "funny" | 143 | 369 |

Les termes génériques ramènent des comptes dix fois plus petits. Les deux sont mauvais.

Une même requête rend les mêmes comptes. Demander 504 profils sur des requêtes déjà lancées en a rendu 135 nouveaux.

---

## 4. Les pistes retenues

### 4.1 Ajouter Google comme canal de découverte

**Le levier principal.** 99% de visée contre 15% aujourd'hui.

Principe : chercher `site:instagram.com "<niche>" "Followers"`, par pays et par langue. L'extrait Google affiche le nombre d'abonnés, par exemple « 312K Followers ».

On connaît donc la taille **avant** d'acheter la fiche. C'est la seule façon connue d'arrêter de payer à l'aveugle.

Coût : 0,0018 $ la page, contre 0,0023 $ la fiche. Moins cher que ce qu'on gaspille.

Effet attendu : le coût par lead passe de 0,35 $ à environ 0,06 $.

**Bloqué par** : il faut une clé d'API de recherche web. Jeremy ne l'a pas encore fournie.

### 4.2 Rendre les comptes exemples obligatoires

Aujourd'hui une campagne peut se créer sans aucun compte exemple. Les deux campagnes créées aujourd'hui n'en avaient aucun, donc le canal lookalike n'a jamais tourné.

Les comptes exemples sont la graine de tout le canal des suggestions, qui est le deuxième meilleur canal mesuré.

À faire : bloquer la création d'une campagne sans au moins trois comptes exemples, et expliquer pourquoi à l'écran.

### 4.3 Monter le seuil de citations de 2 à 3

Donnée du pipeline manuel :

| cité par | passe les filtres |
|---|---|
| 3 graines ou plus | 15% |
| 1 seule graine | 6% |

Notre code compte aujourd'hui une suggestion pour 3 points, une mention pour 1, et exige 2 points. Une seule suggestion suffit donc.

À faire : exiger 3 graines distinctes, pas 3 points.

### 4.4 La taille des graines : relative, jamais absolue

Le pipeline manuel dit que des graines sous 200k donnent 50% de candidats trop petits, contre 7 à 25% pour des graines au-dessus d'1M.

**Mais une règle absolue ne marche pas.** Une campagne qui vise des petits créateurs a besoin de petites graines. Une graine à 1M ne suggère que des comptes à 1M.

À faire : juger la graine par rapport à la fenêtre d'abonnés de la campagne, jamais dans l'absolu. Une bonne graine est une graine qui vit au milieu de la cible.

Reste à définir : quelle position dans la fenêtre. Le milieu, le haut ?

### 4.5 Les filtres gratuits avant de payer, repris du manuel

Trois tris qui ne coûtent rien et qu'on n'applique pas encore :

- **Nom suspect** : official, shop, store, magazine, app, club, studio, news, media, memes, ®, ™. Ces comptes ne sont jamais des personnes.
- **Compte privé** : inutilisable, et visible gratuitement.
- **Déjà connu** : premier filtre du manuel, 73% des candidats. Nous l'avons déjà.

---

## 5. Ce qui ne marche pas, et pourquoi

### Filtrer sur la taille avec l'API Instagram

Le pipeline manuel a essayé de lire le nombre d'abonnés depuis un compte Instagram connecté, avant de payer. L'API des suggestions ne le renvoie pas. La lecture profil par profil déclenche un blocage dès le premier appel. Abandonné pour ne pas risquer le compte.

### Acheter un profil sans ses posts

Vérifié sur un run réel : on demande 1 post par profil, Apify en renvoie jusqu'à 12. 40 profils, 406 posts.

Le paquet est indivisible. On ne peut pas payer moins pour savoir seulement la taille.

Bonne nouvelle : ces 12 posts, on les utilise entièrement. Rien n'est jeté.

### Détecter l'inactivité avant de payer

Rien ne la voit. La date du dernier post arrive avec la fiche. Petite fuite : 3% des fiches chez le manuel, 18 sur 1000 chez nous.

---

## 6. Le pool partagé : un arbitrage à trancher

Un profil payé par une campagne est relu gratuitement par toutes les autres. Bon pour l'argent, mauvais pour la lisibilité et pour la qualité.

Mesuré sur la campagne divertissement : sur 35 profils arrivés jusqu'à l'IA, 5 venaient d'elle et 30 étaient hérités. Cinq des leads livrés étaient des coachs fitness venus de creatormatch.

Le filtre de niche existe pour ça, et il fait son travail : les 23 rejets hors niche venaient tous d'autres campagnes, aucun de ses propres recherches.

Décision à prendre : garder le partage, avec la niche comme garde-fou, ou cloisonner vraiment.

---

## 7. Ordre proposé

1. Google comme canal de découverte, dès qu'on a la clé
2. Comptes exemples obligatoires
3. Seuil de citations à 3 graines distinctes
4. Taille des graines relative à la cible
5. Filtres gratuits sur le nom et les comptes privés

Le point 1 seul fait la moitié du chemin.

---

## 8. Blocages en cours

- Apify à 69,81 $ sur un plafond mensuel de 69 $. Aucun run possible avant relèvement.
- Pas de clé d'API de recherche web pour le canal Google.
- Aucun compte exemple de créateur divertissement 10-100k pour tester le lookalike.
