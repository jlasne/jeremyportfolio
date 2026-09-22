# Découverte : plan d'implémentation

Date : 22/09/2026
Statut : validé sur le principe, rien de codé
Le quoi et le pourquoi sont dans `discovery-plan.md`. Ce fichier dit le comment et dans quel ordre.

---

## La règle de travail

Six chantiers. Chacun est autonome, se vérifie tout seul, et se livre avant que le suivant commence.

Jeremy donne le GO entre chaque. Aucun chantier ne démarre sans lui.

---

## Chantier 0 : le canal des voisins est-il vivant

**Fait le 22/09/2026. Coût réel : 0,025 $.**

### Le problème

Le moteur des vagues est : les qualifiés deviennent les graines, leurs voisins deviennent les candidats. Si les voisins ne reviennent pas, la vague 2 ne fait que relancer les requêtes de la vague 1.

Deux lectures s'opposent. Le pipeline manuel parle d'épuisement de ses graines. Nos runs mesurent un champ vide sur 254 profils jamais vus.

### Ce qu'on fait

1. Reprendre 20 profils déjà payés, de tailles réparties de 20k à 1M, et redemander leur fiche par adresse directe.
2. Compter, pour chacun, si le champ des comptes similaires est présent, et combien de handles il porte.
3. Refaire le même appel avec les réglages d'entrée poussés un par un, pour savoir si un paramètre l'active.
4. Croiser avec la taille de la graine, puisque le manuel mesure 90% de vide sous 100k et 36% au-dessus d'1M.

### Ce qu'on en tire

| résultat | conséquence |
|---|---|
| Le champ revient sur les grosses graines | les vagues ont un moteur, on continue, graines hautes seulement |
| Le champ est vide partout | les vagues n'ont que Google comme moteur, chantier 4 devient bloquant |
| Un réglage l'active | on le met et on continue |

### Résultat, 22/09/2026

**Le canal est vivant. Jeremy avait raison, je l'avais enterré trop vite.**

Mesuré sur les 1 345 profils déjà achetés, sans rien dépenser :

| taille du compte | profils | portent des voisins |
|---|---|---|
| sous 10k | 7 | 0% |
| 10k à 100k | 33 | 6% |
| 100k à 500k | 28 | 18% |
| 500k à 1M | 25 | 40% |
| plus d'1M | 39 | **51%** |

Ces chiffres sont ceux des fiches achetées par adresse directe. Une fiche venue d'une recherche par mot-clé en porte deux à trois fois moins à taille égale.

Ils recoupent ceux du pipeline manuel, qui mesure 90% de vide sous 100k et 36 à 63% au-dessus d'1M.

Mon "zéro sur 214" venait d'un run composé surtout de petits comptes. L'échantillon n'était pas représentatif et la conclusion était fausse.

### Le champ est une propriété du compte, pas un aléa

Douze gros comptes sans voisins ont été rachetés pour 0,025 $. **Zéro s'est rempli.**

Un compte qui ne porte pas de voisins n'en portera pas au second achat. Inutile d'insister, et inutile de le rafraîchir pour ça.

### Le carburant réel, aujourd'hui

| | |
|---|---|
| Comptes en base | 1 115 |
| Porteurs de voisins | 58 |
| Voisins distincts cités | 787 |
| Dont inconnus de nous | **662** |

Soit 11,4 candidats neufs par porteur. Les 40 porteurs au-dessus de 500k en fournissent 624 à eux seuls.

### Ce que ça décide

1. **Les vagues ont un moteur**, mais seulement au-dessus de 500k. Le chantier 3 tient.
2. **Une graine se choisit sur ce qu'elle porte**, pas seulement sur sa taille. On le sait gratuitement une fois sa fiche achetée, et c'est définitif.
3. **Pour une campagne visant 10k à 100k, ce canal ne marche pas.** Les graines de la bonne taille portent 6%, et celles qui portent suggèrent des comptes trop gros. Cette campagne-là dépend de Google, donc du chantier 4.
4. **662 candidats neufs dorment déjà en base**, gratuits. Ils ne demandent qu'à être achetés.

---

## Chantier 1 : ne jamais payer deux fois — LIVRÉ

**Aucune dépendance. Mesuré après coup : 31% de rachat sur la campagne divertissement, plus 0,70 $ de runs tués par le plafond Apify.**

### Trois choses, indépendantes les unes des autres

**1.1 Le rendement par requête.**
Chaque recherche retient ce qu'elle a rendu : profils vus, profils nouveaux, coût. Une requête qui rend zéro nouveau une fois est retirée de la campagne. Une seule fois, pas deux : la recherche de comptes Instagram est déterministe, les mêmes mots rendent la même liste. Un run qui n'a rien acheté ne compte pas comme preuve. `accounts` accepte `force` pour rouvrir une requête retirée.

Mesuré : "street interviewer" plafonne à 6 comptes, "challenge creator" à 20. Les relancer à 72 achète 40 comptes déjà connus pour en gagner zéro.

**1.2 Ne jamais racheter un profil mesuré récemment.**
Avant de lancer une recherche de fiches, on retire les handles mesurés il y a moins de 30 jours. Leurs chiffres sont en base et servent tels quels.

La mesure est universelle, le verdict est par campagne. Un profil rejeté par une campagne est réévalué par la suivante, jamais racheté.

**1.3 La fraîcheur, et l'index qui compose.**
Un profil mesuré il y a plus de 30 jours devient un candidat, jamais un verdict. On rachète sa fiche avant de le juger.

Un profil périmé n'est jamais rejeté sur ses vieux chiffres. Il est rafraîchi ou ignoré.

C'est cette règle qui rend l'index utilisable. Chaque profil acheté reste en base pour toujours, et une campagne y trouve des candidats sans rien dépenser. Sans la règle de fraîcheur, plus l'index grossit et plus il ment. Avec elle, on ne repaie que les profils qui méritent un examen.

Aujourd'hui : 1 576 comptes en base. À 100 000, une campagne y trouve 3 000 candidats gratuits.

### Vérifié par

Mesuré sur les trois campagnes vivantes, sans dépenser un centime de plus.

| campagne | fiches achetées | nouvelles | rachat | perdu | $ / lead |
|---|---|---|---|---|---|
| Divertissement | 730 | 506 | 31% | 0,70 $ | 0,52 $ |
| Chien | 258 | 236 | 9% | 0 | 0,29 $ |
| Fitness 100k-3M | 353 | 312 | 12% | 0 | 0,31 $ |

Requêtes retirées : `challenge creator` et `street interviewer` sur divertissement, `fitness ebook author` sur fitness. Relancées, elles répondent « retirée », sans run et sans coût.

Rachat : six handles déjà mesurés ce mois-ci, demandés à `detailRun`, donnent `asked 6, handles 0, skipped 6`. Aucun run lancé.

Fraîcheur : zéro profil de la base dépasse 30 jours. La règle est posée et dort.

### Deux choses trouvées en chemin, corrigées

**Quatorze runs tués par le plafond Apify.** Apify ne refuse pas un run quand le compte a atteint son plafond mensuel : il le lance, le laisse travailler trois minutes, puis le tue — et facture les trois minutes. 0,70 $ perdus, 14% de la facture de la campagne. `startRun` lit désormais le solde du cycle avant chaque run et refuse en dessous de 3 $, réserve laissée au pipeline manuel qui partage le même compte.

**Quatorze runs jamais refermés.** Le webhook n'était jamais arrivé, donc la campagne s'affichait à 2,21 $ au lieu de 5,08 $ et à 0,23 $ le lead au lieu de 0,52 $. `sourcing.reconcile` demande à Apify ce qui s'est vraiment passé et referme. Un run qui a réussi et dont on n'a jamais lu les lignes reste ouvert : les refermer perdrait ce qu'on a payé.

---

## Chantier 1bis : un canal par fenêtre de cible — LIVRÉ, CANAL RÉFUTÉ

**Le cadran de taille est validé en conditions réelles. Le canal qui devait l'alimenter est mort. Coût de la mesure : 3,82 $.**

### Ce que le chantier 0 a révélé

Notre seul canal de découverte vise à 15%. Le canal des voisins, qui aurait pu le remplacer, ne marche qu'au-dessus de 500k abonnés.

Une campagne qui vise des créateurs de 10k à 100k n'avait donc rien. C'est exactement la campagne divertissement, et c'est un type de client courant.

### La troisième voie, mesurée le 22/09

Une recherche de posts rend les likes et le nom de l'auteur. Les likes trahissent la taille du compte.

Mesuré sur nos 1 075 comptes ayant des likes lisibles :

| likes sur un post type | abonnés médians |
|---|---|
| 0 à 50 | 1 083 |
| 50 à 150 | 8 987 |
| 150 à 400 | 25 931 |
| 400 à 800 | 128 140 |
| 800 à 1 500 | 227 128 |
| 1 500 à 3 000 | 433 760 |
| 3 000 à 8 000 | 469 021 |
| 8 000 et plus | 1 214 549 |

La progression est monotone. Une bande de likes est un cadran de taille.

### Ce que ça donne par fenêtre de cible

| cible | bande de likes | dans la cible |
|---|---|---|
| 10k à 100k | 100 à 400 | **43%** |
| 100k à 3M | 1 000 à 20 000 | **81%** |
| 500k et plus | 5 000 et plus | 62% |

Contre 26% sans filtre sur la même population, et 15% pour notre recherche par nom de compte.

**Réserve à connaître** : ces parts sont mesurées sur des comptes que nos canaux actuels ont déjà trouvés. C'est la puissance du filtre sur une population connue, pas une mesure du canal en conditions réelles. Le mécanisme, lui, est solidement établi.

### La règle de choix

La fenêtre d'abonnés de la campagne décide des canaux, et l'écran le dit au client.

| fenêtre visée | canal principal | canal d'appoint |
|---|---|---|
| sous 50k | posts, bande 50 à 200 likes | Google |
| 50k à 500k | Google | posts, bande 200 à 1 500 likes |
| 500k et plus | voisins des graines porteuses | Google, posts bande haute |

Google fonctionne partout et reste la colonne vertébrale. Les voisins sont un canal de qualité, jamais de volume : 11 candidats neufs par porteur.

### Ce qu'on construit

1. Chaque canal devient une source nommée, avec son coût et sa visée mesurés par campagne.
2. La campagne choisit ses canaux d'après sa fenêtre, et le client voit lesquels et pourquoi.
3. La recherche de posts arrive comme canal, avec une bande de likes calculée depuis la fenêtre.
4. Chaque run enregistre la visée réelle par canal, et le prochain run rééquilibre vers celui qui vise le mieux sur cette campagne.

### Ce qui a été construit

`channels.ts` : la table likes → abonnés, l'inversion sur échelle log, la bande pour n'importe quelle fenêtre, et `bandCheck` qui mesure gratuitement la visée d'une bande sur notre propre base.

`channels.plan` : la fenêtre de la campagne choisit ses canaux, avec la raison écrite pour le client.

`sourcing.aim` : la visée réelle par canal **par campagne**. L'écran ops mélangeait toutes les campagnes, ce qui répond à une question que personne ne pose.

### Le réglage de la bande : mesuré, pas deviné

J'avais serré les bords de 35%. Mesuré sur nos 1 273 comptes, c'était une erreur.

| bords | visée | portée |
|---|---|---|
| bruts | 39% | 37% |
| serrés 35% | 41% | 23% |
| serrés 100% | 46% | 7% |

Deux points de visée contre trente de portée. Bords bruts, aucune constante à régler.

### Vérifié par : un vrai run, 3,82 $

**Le cadran marche.** Sur les 23 auteurs retenus par la bande, 10 sont dans la fenêtre 10k-100k. **43% de visée**, contre 41% prédits depuis notre base et 24% pour la recherche de comptes. La meilleure visée de tous nos canaux.

**Le canal est inabordable.** Un post coûte 0,23 centime, exactement le prix d'une fiche. Et 81% des 1 225 auteurs sous huit hashtags de sujet font moins de 50 likes, médiane 1.

| canal | coût par candidat dans la fenêtre |
|---|---|
| posts sous hashtag, avec bande | **0,38 $** |
| recherche de comptes | **0,01 $** |

Les hashtags Instagram ne sont pas l'endroit où postent les créateurs qui valent 38 centimes. Canal coupé. Le cadran est gardé et validé : il attend une source de posts de vrais créateurs.

### Visée réelle par canal, mesurée

| campagne | fenêtre | voisins | comptes | hashtags |
|---|---|---|---|---|
| Divertissement | 10k-100k | 26% | 24% | 13% |
| Fitness | 100k-3M | 32% | 26% | 3% |
| Chien | 20k-1M | 40% | 47% | 10% |

Le canal hashtag non filtré est le pire des trois, partout.

### Ce qui reste ouvert

La fenêtre 10k-100k n'a toujours pas de bon canal. Les voisins y visent 26%, la recherche de comptes 24%. Le chantier 4 (Google) est la prochaine piste, et il est bloqué faute de clé.

### Une erreur qui a coûté 3,20 $

`resultsLimit` d'Apify est **par URL**, pas par run. Huit hashtags à 200 posts font 1 600 posts. J'ai demandé 200 et payé 1 600. Corrigé : la limite est divisée par le nombre d'URL, le chiffre passé est le nombre de posts payés.

---

## Chantier 2 : les graines

**Dépend de 0 pour son utilité. Peut être construit avant.**

### Quatre choses

**2.1 Obligatoires à la création.**
Une campagne ne se crée plus sans au moins trois comptes exemples. L'écran dit pourquoi : sans eux le meilleur canal ne démarre jamais.

Les deux campagnes créées le 21/09 n'en avaient aucune. Le canal voisins n'a donc jamais tourné.

**2.2 Une graine a deux métiers, et il faut les séparer.**

Corrigé par le chantier 0. Une graine sert à deux choses qui n'ont pas les mêmes exigences.

| métier | ce qu'il demande | pour quelles campagnes |
|---|---|---|
| Moteur de découverte | porter des voisins, donc peser plus de 500k | les campagnes qui visent haut |
| Montrer au juge à quoi ressemble un bon | être dans la cible, rien d'autre | toutes |

Pour une campagne qui vise 10k à 100k, aucune graine ne fera moteur : celles de la bonne taille portent 6%, et celles qui portent suggèrent des comptes trop gros.

Ses graines servent alors uniquement le second métier, et sa découverte passe par le chantier 1bis.

L'écran demande donc des graines dans la cible pour tout le monde, et propose en plus des graines hautes quand la campagne vise au-dessus de 500k.

**2.3 Les voisins de nos propres leads.**
Un lead qualifié devient une graine de la campagne. Sa fiche est déjà payée, donc la graine est gratuite.

Corrigé par le chantier 0 : un lead ne devient une graine que **s'il porte des voisins**. On le sait au moment où sa fiche arrive, et c'est définitif. Un lead qui n'en porte pas est un bon lead et une mauvaise graine.

Il y a déjà 662 candidats neufs cités par nos 58 porteurs actuels, et personne ne les a achetés.

**2.4 Graines croisées entre campagnes.**
Un créateur qualifié pour une campagne sert de graine à une autre campagne de la même niche. Jamais hors niche.

### Vérifié par

Une campagne créée sans graine doit être refusée. Une campagne avec quatre graines étalées doit montrer sa couverture de fourchette.

---

## Chantier 3 : les vagues

**Dépend de 1. Meilleur avec 0 et 4.**

### Le principe

Un run n'engage plus tout son budget d'un coup. Il avance par vagues, chacune apprenant de la précédente.

| vague | taille | ce qu'elle fait |
|---|---|---|
| 1 | 400 | découverte pure, sur les graines du client |
| 2 | 600 | plus les voisins des qualifiés de la vague 1 |
| 3 et suite | jusqu'à 3000 | les graines s'enrichissent à chaque tour |

### Ce qui est décidé entre deux vagues

- Les requêtes qui ont rendu zéro nouveau sont retirées
- Les qualifiés deviennent des graines
- Le budget restant va vers le canal qui a le mieux visé sur cette campagne
- Le run s'arrête tôt si la cible du jour est atteinte

### Le réglage à trancher, non tranché

Quelle part de chaque vague va aux voisins des bonnes graines, et quelle part à de la découverte neuve.

Départ proposé : 70% voisins, 30% neuf. Rien ne le fonde encore.

Trop peu de sang neuf et le pool converge sur le premier lead qualifié. La cible se rétrécit sans que personne le voie.

Ce réglage se mesure sur trois vagues avant d'être fixé, et il bouge sans doute : beaucoup d'exploration au début, plus d'exploitation quand les graines sont bonnes.

### Vérifié par

Un run de 3000 en vagues contre un run de 3000 d'un coup, sur la même campagne, coût et leads comparés.

---

## Chantier 4 : Google

**Dépend d'une clé de recherche web que nous n'avons pas.**

### Le principe

Chercher `site:instagram.com "<niche>" "Followers"`, par pays et par langue. L'extrait Google affiche le nombre d'abonnés.

On connaît donc la taille avant d'acheter la fiche. On n'achète que ce qui est dans la fourchette.

| | visée |
|---|---|
| Google | 99% |
| Notre recherche par nom de compte | 15% |

### Ce que ça change

Le coût par lead passe de 0,35 $ à environ 0,07 $. C'est la moitié du chemin à lui seul.

### La limite à connaître

Google ne donne que le nombre d'abonnés. Rien sur les vues, la cadence ou la date du dernier post. On supprime 62% du gâchis, pas la totalité.

### Vérifié par

100 pages Google sur une niche connue. Combien de handles sortis, combien dans la fourchette, coût réel par candidat utile.

---

## Chantier 5 : repasser les échecs de peu

**Dépend de 1. Petit chantier.**

Un compte à 9 800 abonnés en aura 10 500 dans deux mois. Un compte inactif depuis 15 jours peut reposter demain.

Les profils qui ratent une règle de peu sont marqués et repassés au bout d'un délai, sans nouvelle découverte. Leur fiche est rachetée, c'est tout.

### Vérifié par

Le nombre de profils repassés et le nombre qui passent au second essai.

---

## L'ordre

| # | chantier | dépend de | bloqué par |
|---|---|---|---|
| 0 | Le canal des voisins | rien | **fait le 22/09** |
| 1 | Ne jamais payer deux fois | rien | rien |
| 1bis | Un canal par fenêtre de cible | 0 | rien |
| 2 | Les graines | rien pour construire | rien |
| 3 | Les vagues | 1 | rien |
| 4 | Google | rien pour construire | la clé de recherche |
| 5 | Les échecs de peu | 1 | rien |

Le 0 en premier parce qu'il coûte une heure et décide du reste.
Le 1 ensuite parce qu'il rapporte sans rien débloquer.

---

## Ce qui reste hors de ce plan

| sujet | pourquoi |
|---|---|
| Agent navigateur et API interne Instagram | écartés par Jeremy le 22/09 |
| API Meta Business | écartée, deux systèmes de mesure |
| Grand index d'un coup | écarté, capex et fraîcheur |
| Pool partagé ou cloisonné | arbitrage non tranché |
| 50 requêtes au lieu de 8 | à tester, pas encore validé |
| Fiches des marketplaces | à tester |
| Pré-filtre par les likes | à tester |

---

## Blocages en cours

- Apify à 69,81 $ sur un plafond mensuel de 69 $. Aucun run possible avant relèvement.
- Pas de clé de recherche web, ce qui bloque le chantier 4.
