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
| 26 | **L'agent navigateur qui lit l'arbre d'accessibilité** | voir ci-dessous. Le test tranche en une heure et ne consomme aucun budget Apify. |

#### L'agent navigateur, la piste la plus prometteuse

Un agent pilote un navigateur distant et lit l'**arbre d'accessibilité** de la page, ce que lit un lecteur d'écran. Du texte structuré, pas des images, donc pas de modèle de vision.

Annoncé par ses auteurs : une tâche de 8 étapes, connexion comprise, pour 0,001 $.

| | coût par profil examiné |
|---|---|
| Agent navigateur, 4 étapes | 0,0005 $ |
| Apify | 0,0023 $ |

Quatre fois moins cher, si le chiffre tient hors de leur démonstration.

Ce que ça débloque : le panneau "suggestions pour vous" est du texte affiché dans la page, donc présent dans l'arbre. C'est exactement la donnée qu'Apify ne rend plus et que l'API interne va chercher illégalement. Ici on la lit là où Instagram l'affiche.

Quatre réserves : leur démonstration tourne sur un site de test alors qu'Instagram charge en continu et se défend ; le prix annoncé est celui du modèle, pas du navigateur distant ; un navigateur distant se détecte mieux qu'un vrai ; il faut toujours une session connectée, donc le risque de compte demeure.

**Le test qui tranche** : ouvrir dix profils Instagram connus, vérifier que le panneau de suggestions sort dans l'arbre d'accessibilité, mesurer le coût réel. Si les suggestions n'y sont pas, l'idée meurt en une heure.

### Refusé

| # | piste | raison |
|---|---|---|
| 20 | S'arrêter au plafond quotidien du client pour juger moins | on livre tout, quel que soit le forfait |
| ancien 2 | Liste noire globale des comptes rejetés | un compte rejeté par une campagne peut convenir à une autre |
| 7 | Co-auteurs de posts collab | mesuré, voir ci-dessous |
| 5 | Voisins livrés avec la fiche Apify | le canal est mort, voir ci-dessous |

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

#### Pourquoi le canal des voisins Apify est mort

Il était classé deuxième meilleur canal, à 68% de visée. Ce chiffre est une archive.

Le pipeline manuel, interrogé le 21/09 :

| période | voisins récoltés |
|---|---|
| 8 au 11 septembre | 9 555 |
| 12 au 20 septembre | 756 |

Sur des graines de moins de 100k abonnés, ils mesurent aujourd'hui 94% de fiches sans aucun voisin. De notre côté : 1 fiche sur 40 en portait, et zéro sur 214 dans un run par adresse directe.

Leur hypothèse, non vérifiée : Instagram a cessé de remplir ce champ pour les requêtes non connectées, que l'acteur Apify utilise.

Ce qui marche encore chez eux est une API interne d'Instagram appelée depuis un navigateur connecté. Gratuite, 80 comptes par appel, 42 à 54 inédits par graine, 2 à 4% d'échec. Hors conditions d'utilisation, et sur un compte qui peut être suspendu.

Un détail qui dit le danger : l'autre API interne, celle qui donnerait le nombre d'abonnés, bloque dès le premier appel. Testée deux fois, refusée deux fois.

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

## 6. Le design itératif, par vagues

Proposé par Jeremy, 21/09/2026. Remplace le run unique qui engage tout le budget avant de rien savoir.

### Le principe

Au lieu d'acheter 1000 profils d'un coup sur des requêtes décidées à l'avance, on avance par vagues. Chaque vague apprend de la précédente et réoriente la suivante.

| vague | taille | ce qu'on fait |
|---|---|---|
| 1 | ~300 | Google seul. On lit le nombre d'abonnés dans l'extrait, on n'achète que ce qui est dans la fourchette. |
| 2 | ~1000 | Google, plus les voisins des meilleurs qualifiés de la vague 1. |
| 3 et suivantes | croissant | Même chose, les graines s'enrichissent à chaque tour. |

### Pourquoi c'est meilleur qu'un run unique

Trois raisons, chacune mesurée aujourd'hui.

1. **On arrête ce qui ne rend rien.** Deux requêtes sur sept ont rendu zéro nouveau compte au second passage, et on a payé quand même.
2. **On fabrique ses propres graines.** Le canal des voisins ne démarre pas sans comptes donnés par le client. Les deux campagnes créées aujourd'hui n'en avaient aucun, donc le deuxième meilleur canal n'a jamais tourné.
3. **On réalloue vers ce qui marche pour cette campagne.** Le taux de visée d'un canal n'est pas le même d'une niche à l'autre.

### Les graines s'étalent sur toute la fourchette

Instagram calcule les comptes similaires sur le recouvrement d'audience. Une graine à 100k suggère des comptes à 100k. Si toutes les graines sont en haut de la fourchette, le bas n'est jamais exploré.

Le mécanisme est confirmé par le pipeline manuel :

| taille des graines | candidats trop petits |
|---|---|
| Sous 200k | 50% |
| Au-dessus d'1M | 7 à 25% |

Donc : une graine à plusieurs hauteurs de la fourchette, jamais toutes au même endroit.

**Correction sur le découpage naïf.** Ne pas poser de graine au plancher. Une graine à 10k suggère des comptes sous 10k, donc hors cible. Pour une fourchette 10-100k, viser plutôt 20k, 45k, 70k, 100k. Décalé vers le haut.

Une graine doit aussi être dans la niche, sinon ses voisins n'y sont pas non plus.

### Ce que ça donnerait, estimé

| | aujourd'hui | avec Google et l'itération |
|---|---|---|
| Taux de visée | 3% | ~36% |
| Profils achetés pour 30 survivants | 1000 | 83 |
| Coût du run | 2,46 $ | 0,53 $ |
| Par lead | 0,35 $ | 0,08 $ |

Les 36% viennent du manuel : 99% des fiches achetées via Google sont dans la fourchette d'abonnés, et 36% de celles-ci passent aussi les filtres d'activité.

### La limite de Google

Google ne donne que le nombre d'abonnés. Rien sur les vues, la cadence ou la date du dernier post.

Donc il supprime 62% du gâchis, pas la totalité. Le reste se découvre après l'achat, comme aujourd'hui.

### Le risque : la convergence

Se semer soi-même fait converger. Vague après vague, tous les candidats ressemblent au premier lead qualifié. La cible se rétrécit sans que personne le voie.

Il faut injecter du sang neuf à chaque vague, venu d'ailleurs que des vagues précédentes.

### À clarifier : le ratio graines contre découverte neuve

**Question ouverte, non tranchée.**

Quelle part de chaque vague va aux voisins des bonnes graines, et quelle part à de la découverte qui ne vient pas de nous ?

Une piste de départ : 70% de voisins, 30% de sang neuf. Mais rien ne le fonde encore.

Ce réglage décide à lui seul si le système trouve de mieux en mieux, ou se referme sur lui-même. Il faut le mesurer sur plusieurs vagues avant de le fixer, et sans doute le laisser bouger : beaucoup d'exploration au début, davantage d'exploitation quand les graines sont bonnes.

---

## 7. Les designs alternatifs examinés

Explorés le 21/09/2026, avec une recherche sur ce qui existe ailleurs.

### Écarté : l'API Business Discovery de Meta

Elle mesure un profil gratuitement et sa capacité grossit avec le nombre de clients connectés, 200 appels par heure et par utilisateur actif de l'app.

**Écarté par Jeremy** : faire coexister l'API Meta et Apify pour mesurer donne deux chemins pour la même chose, avec deux pannes possibles et deux formats à réconcilier. Le gain ne paie pas cette complexité.

Sa vraie faiblesse, au delà de la complexité : le compte visé doit être un compte professionnel public. On ne sait pas quelle part des créateurs 10-100k le sont, et un pipeline qui ignore silencieusement une partie de la cible est pire qu'un pipeline cher.

### Écarté : construire un grand index d'un coup

Le modèle Modash, 250 millions de profils crawlés en continu, une campagne devenant une simple requête en base.

**Écarté par Jeremy** : gros investissement d'avance, et la fraîcheur condamne l'index à se périmer plus vite qu'on ne le remplit. L'index se construira tout seul, run après run, ce qui est déjà le cas.

### Gardé comme piste, sans enthousiasme : acheter un index tiers

Un abonnement Modash ou équivalent. Zéro découverte, filtres inclus, 250 millions de profils.

Coût fixe, aucune dépense variable, mais rien qui nous appartienne et une dépendance totale.

### Retenu : changer d'où viennent les pseudos, sans toucher au reste

Le point qui distingue ces pistes des deux écartées : elles ne changent **que la source des pseudos**. La mesure reste Apify, un seul chemin, un seul format.

| source | prix | dans la cible | vrai prix d'un candidat utile |
|---|---|---|---|
| Voisins en masse, acteur dédié | 0,0010 $ | 68% | 0,0015 $ |
| Google | 0,0018 $ | 99% | 0,0018 $ |
| Notre recherche par nom de compte | 0,0023 $ | 15% | 0,0153 $ |

Un acteur dédié aux voisins rend environ 49 comptes similaires par graine, contre 8 livrés avec une fiche payée.

Estimation à mesure inchangée, en achetant la fiche Apify de chaque candidat :

| chemin | coût du run | par lead |
|---|---|---|
| Aujourd'hui | 2,46 $ | 0,35 $ |
| Par les voisins en masse | 0,58 $ | 0,082 $ |
| Par Google, en n'achetant que ce qui est dans la fourchette | 0,50 $ | 0,071 $ |

Quatre à cinq fois moins cher, sans ajouter un deuxième système de mesure.

---

## 8. Ce qui ne marche pas, et pourquoi

### Filtrer sur la taille avec l'API Instagram

Le pipeline manuel a essayé de lire le nombre d'abonnés depuis un compte Instagram connecté, avant de payer. L'API des suggestions ne le renvoie pas. La lecture profil par profil déclenche un blocage dès le premier appel. Abandonné pour ne pas risquer le compte.

### Acheter un profil sans ses posts

Vérifié sur un run réel : on demande 1 post par profil, Apify en renvoie jusqu'à 12. 40 profils, 406 posts.

Le paquet est indivisible. On ne peut pas payer moins pour savoir seulement la taille.

Bonne nouvelle : ces 12 posts, on les utilise entièrement. Rien n'est jeté.

### Détecter l'inactivité avant de payer

Rien ne la voit. La date du dernier post arrive avec la fiche. Petite fuite : 3% des fiches chez le manuel, 18 sur 1000 chez nous.

---

## 9. Le pool partagé : un arbitrage à trancher

Un profil payé par une campagne est relu gratuitement par toutes les autres. Bon pour l'argent, mauvais pour la lisibilité et pour la qualité.

Mesuré sur la campagne divertissement : sur 35 profils arrivés jusqu'à l'IA, 5 venaient d'elle et 30 étaient hérités. Cinq des leads livrés étaient des coachs fitness venus de creatormatch.

Le filtre de niche existe pour ça, et il fait son travail : les 23 rejets hors niche venaient tous d'autres campagnes, aucun de ses propres recherches.

Décision à prendre : garder le partage, avec la niche comme garde-fou, ou cloisonner vraiment.

---

## 10. Ordre proposé

1. Google comme canal de découverte, dès qu'on a la clé
2. Le design itératif par vagues, qui a besoin de Google pour sa première vague
3. Graines étalées sur la fourchette, décalées vers le haut
4. Rendement et profondeur par requête
5. Comptes exemples obligatoires, qui deviennent le sang neuf des vagues suivantes
6. Fraîcheur : rafraîchir une fiche de plus de 30 jours avant de juger dessus
7. Filtres gratuits sur le nom et les comptes privés

Le point 1 seul fait la moitié du chemin. Les points 1 à 3 forment un tout : l'itération sans Google n'a rien de bon à mettre dans sa première vague.

---

## 11. Les questions encore ouvertes

| question | pourquoi elle compte |
|---|---|
| Le ratio graines contre découverte neuve à chaque vague | décide si le système s'améliore ou se referme sur lui-même |
| Où placer les graines dans la fourchette | trop bas elles sortent de la cible, trop haut elles ratent le bas |
| Garder le pool partagé ou cloisonner par campagne | change la lecture de toutes les statistiques |
| Supprimer les librairies de règles | validé sur le principe, pas encore fait |

---

## 12. Blocages en cours

- Apify à 69,81 $ sur un plafond mensuel de 69 $. Aucun run possible avant relèvement.
- Pas de clé d'API de recherche web pour le canal Google.
- Aucun compte exemple de créateur divertissement 10-100k pour tester le lookalike.
