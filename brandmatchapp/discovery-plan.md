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

## 4. Les pistes, et ce qui a été décidé

Décisions de Jeremy, 21/09/2026.

### Validé, à faire

| # | piste | preuve ou raison |
|---|---|---|
| 1 | Retenir le rendement de chaque requête et arrêter celles qui plafonnent | 62% de rachat mesuré sur un second passage |
| 2 | Ne jamais racheter un profil déjà mesuré, toujours le réévaluer | la mesure est universelle, le verdict est par campagne |
| 3 | Mesurer la profondeur d'une requête avant d'en redemander | "street interviewer" plafonne à 6 comptes, "challenge creator" à 20 |
| 4 | Google comme canal, le nombre d'abonnés est dans l'extrait | 99% de visée contre 15% |
| 5 | Voisins Apify, livrés gratuitement avec chaque fiche | 68% de visée |
| 6 | Suggestions Instagram depuis les graines, graines obligatoires | 60% de visée |
| 22 | Les voisins de nos propres leads livrés | un lead qualifié est la meilleure graine |
| 23 | Repasser les échecs de peu, pour la souplesse | un compte à 9 800 abonnés en aura 10 500 dans deux mois |
| 24 | Graines croisées entre campagnes, si la niche correspond | un créateur qualifié sert à la campagne suivante |
| 25 | L'index qui compose, chaque profil acheté reste en base | voir la section fraîcheur ci-dessous |

### À tester avant de décider

| # | piste | ce qu'il faut mesurer |
|---|---|---|
| 10 | Fiches publiques des marketplaces, indexées par Google | taux de visée et coût par compte |
| 14 | Faire écrire 50 requêtes par l'IA au lieu de 8 | volume réel gagné, chaque requête plafonnant vers 40 à 70 |
| 15 | La qualité baisse-t-elle avec la profondeur d'une requête | si oui, large et peu profond bat étroit et profond |
| 16 | Recherche de posts filtrée sur les likes | retenu seulement si moins cher et meilleur rendement |

### Refusé

| # | piste | raison |
|---|---|---|
| 20 | S'arrêter au plafond quotidien du client pour juger moins | on livre tout, quel que soit le forfait |
| ancien 2 | Liste noire globale des comptes rejetés | un compte rejeté par une campagne peut convenir à une autre |
| 7 | Co-auteurs de posts collab | mesuré, voir ci-dessous |

#### Pourquoi les co-auteurs ne marchent pas

Hypothèse testée : deux créateurs sur un même post sont des pairs de taille voisine.

Mesuré sur 40 profils, 406 posts : 17 paires de co-auteurs, dont

| ce que c'était | nombre |
|---|---|
| Le compte co-auteur de lui-même | 5 |
| Le deuxième compte de la même marque | 4 |
| Un client ou un élève du créateur | 6 |
| Un pair plausible | 2 |

Soit 0,4 paire par profil, dont 12% d'utilisable. Le collab sert à mettre en avant ses clients et son propre second compte, pas à se lier à ses pairs.

### En attente d'arbitrage

| # | piste | pourquoi elle n'est pas tranchée |
|---|---|---|
| 8 | Créateurs qui commentent, pseudos dans les commentaires achetés | gratuit, mais le préjugé est mauvais : un commentateur est presque toujours un membre de l'audience, pas un pair |
| 9 | Articles de listes, "top 50 comedy creators" | non discuté |
| 11 | TikTok et YouTube comme index | non discuté |
| 17 | Compter les graines distinctes qui citent un candidat | 3 graines : 15% passent, 1 graine : 6% |
| 18 | Écarter les noms de marques avant de payer | official, shop, app, media, memes |
| 19 | Écarter les comptes privés | visible gratuitement |
| 21 | Plusieurs profils dans un seul appel modèle | faible enjeu, le jugement pèse 5% |

---

## 5. La fraîcheur des données

Soulevé par Jeremy. L'index qui compose n'a de valeur que si ce qu'il contient est encore vrai.

Un profil mesuré il y a six mois porte un nombre d'abonnés faux, une cadence fausse et une date de dernier post périmée. Le filtre chiffré appliqué dessus rejette ou accepte pour de mauvaises raisons.

### La règle proposée

| âge de la mesure | ce qu'on en fait |
|---|---|
| Moins de 30 jours | on lui fait confiance, aucune dépense |
| Plus de 30 jours | il sert de candidat, jamais de verdict. On rachète la fiche avant de juger. |

Ainsi l'index reste presque gratuit : on ne repaie que pour les profils qui méritent un examen, jamais pour l'ensemble.

Sans cette règle, l'index devient un piège : plus il grossit, plus il ment.

### Ce que ça implique

Un profil périmé ne doit jamais être rejeté sur ses vieux chiffres. Il est soit rafraîchi, soit ignoré, jamais jugé sur du faux.

---

## 6. Ce qui ne marche pas, et pourquoi

### Filtrer sur la taille avec l'API Instagram

Le pipeline manuel a essayé de lire le nombre d'abonnés depuis un compte Instagram connecté, avant de payer. L'API des suggestions ne le renvoie pas. La lecture profil par profil déclenche un blocage dès le premier appel. Abandonné pour ne pas risquer le compte.

### Acheter un profil sans ses posts

Vérifié sur un run réel : on demande 1 post par profil, Apify en renvoie jusqu'à 12. 40 profils, 406 posts.

Le paquet est indivisible. On ne peut pas payer moins pour savoir seulement la taille.

Bonne nouvelle : ces 12 posts, on les utilise entièrement. Rien n'est jeté.

### Détecter l'inactivité avant de payer

Rien ne la voit. La date du dernier post arrive avec la fiche. Petite fuite : 3% des fiches chez le manuel, 18 sur 1000 chez nous.

---

## 7. Le pool partagé : un arbitrage à trancher

Un profil payé par une campagne est relu gratuitement par toutes les autres. Bon pour l'argent, mauvais pour la lisibilité et pour la qualité.

Mesuré sur la campagne divertissement : sur 35 profils arrivés jusqu'à l'IA, 5 venaient d'elle et 30 étaient hérités. Cinq des leads livrés étaient des coachs fitness venus de creatormatch.

Le filtre de niche existe pour ça, et il fait son travail : les 23 rejets hors niche venaient tous d'autres campagnes, aucun de ses propres recherches.

Décision à prendre : garder le partage, avec la niche comme garde-fou, ou cloisonner vraiment.

---

## 8. Ordre proposé

1. Google comme canal de découverte, dès qu'on a la clé
2. Co-auteurs et commentateurs : gratuits, les données sont déjà achetées
3. Rendement et profondeur par requête
4. Comptes exemples obligatoires
5. Fraîcheur : rafraîchir une fiche de plus de 30 jours avant de juger dessus
6. Filtres gratuits sur le nom et les comptes privés

Le point 1 seul fait la moitié du chemin.

---

## 9. Blocages en cours

- Apify à 69,81 $ sur un plafond mensuel de 69 $. Aucun run possible avant relèvement.
- Pas de clé d'API de recherche web pour le canal Google.
- Aucun compte exemple de créateur divertissement 10-100k pour tester le lookalike.
