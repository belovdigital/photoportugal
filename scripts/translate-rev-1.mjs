// Reviews batch 1 — first 30 reviews → PT/DE/ES/FR
import pg from "pg";
const { Client } = pg;

const REV = [
  {
    id: "093c7e97-4192-4796-a281-168de0dfc758",
    title: {
      pt: "Dois profissionais perfeitamente coordenados",
      de: "Zwei Profis, perfekt aufeinander abgestimmt",
      es: "Dos profesionales perfectamente coordinados",
      fr: "Deux professionnels parfaitement coordonnés",
    },
    text: {
      pt: "São dois profissionais bem coordenados que interpretaram na perfeição aquilo que pedimos. Sempre atentos, sem incomodar os convidados, captaram inúmeras fotos únicas de momentos únicos, envolvendo todos os nossos convidados.",
      de: "Das sind zwei perfekt eingespielte Profis, die genau verstanden haben, was wir wollten. Stets aufmerksam, ohne die Gäste zu stören, haben sie unzählige einzigartige Fotos von einzigartigen Momenten gemacht und dabei alle unsere Gäste eingebunden.",
      es: "Son dos profesionales muy compenetrados que interpretaron a la perfección lo que les pedimos. Siempre atentos, sin molestar a los invitados, capturaron muchísimas fotos únicas de momentos únicos, involucrando a todos los presentes.",
      fr: "Ce sont deux professionnels parfaitement coordonnés qui ont interprété à merveille ce que nous demandions. Toujours attentifs, sans déranger les invités, ils ont capturé une multitude de photos uniques de moments uniques, en impliquant tous nos invités.",
    },
  },
  {
    id: "a04debf3-7ab5-483c-9f82-fc5888301a50",
    title: {
      pt: "Profissional muito atento, incansável e bem-disposto",
      de: "Sehr aufmerksamer, unermüdlicher und freundlicher Profi",
      es: "Profesional muy atento, incansable y de buen humor",
      fr: "Professionnel très attentif, infatigable et de bonne humeur",
    },
    text: {
      pt: "Um profissional muito atento — super educado, incansável e sempre bem-disposto. Esteve em todo o lado, em todos os momentos importantes e até nos mais espontâneos. Excelente relação preço/serviço. Recomendo vivamente!",
      de: "Ein äußerst aufmerksamer Profi — super höflich, unermüdlich und immer bestens gelaunt. Er war überall, bei jedem wichtigen Moment und auch bei den spontansten. Ausgezeichnetes Preis-Leistungs-Verhältnis. Sehr zu empfehlen!",
      es: "Un profesional muy atento — súper educado, incansable y siempre de buen humor. Estuvo en todas partes, en cada momento importante e incluso en los más espontáneos. Excelente relación precio/servicio. ¡Muy recomendable!",
      fr: "Un professionnel très attentif — super poli, infatigable et toujours de bonne humeur. Il était partout, à chaque moment important et même aux plus spontanés. Excellent rapport qualité/prix. Vivement recommandé !",
    },
  },
  {
    id: "2a977c3b-f4cc-4fd5-be93-7b020b4777f3",
    title: {
      pt: "A Glória tem uma sensibilidade incrível",
      de: "Glória hat eine unglaubliche Sensibilität",
      es: "Glória tiene una sensibilidad increíble",
      fr: "Glória a une sensibilité incroyable",
    },
    text: {
      pt: "A Glória tem uma sensibilidade espetacular. Tem o dom de captar momentos como mais ninguém. A Joana, que também fotografou, é igualmente fantástica. Deixaram-nos completamente à vontade, sem poses nem encenações. A sessão foi divertida, passou super depressa e o resultado foi incrível. Super recomendo!",
      de: "Glória hat eine spektakuläre Sensibilität. Sie hat ein einzigartiges Talent, Momente einzufangen wie niemand sonst. Joana, die ebenfalls fotografiert hat, ist genauso großartig. Sie haben uns absolut entspannt sein lassen — ohne Posen oder Inszenierung. Das Shooting war lustig, ging blitzschnell vorbei und das Ergebnis war fantastisch. Sehr zu empfehlen!",
      es: "Glória tiene una sensibilidad espectacular. Tiene un don para capturar momentos como nadie. Joana, que también fotografió, es igualmente fantástica. Nos pusieron totalmente cómodos, sin poses ni montajes. La sesión fue divertida, se pasó volando y el resultado fue increíble. ¡Muy recomendable!",
      fr: "Glória a une sensibilité spectaculaire. Elle a un don pour capturer les moments comme personne. Joana, qui a aussi photographié, est tout aussi formidable. Elles nous ont mis totalement à l'aise, sans poses ni mises en scène. La séance a été amusante, est passée à toute vitesse et le résultat est incroyable. Je recommande vivement !",
    },
  },
  {
    id: "2c1de8ef-8084-4e1a-b863-78be31fdb1d5",
    title: {
      pt: "Um trio fantástico — integraram-se na festa",
      de: "Ein fantastisches Trio — sie waren Teil der Feier",
      es: "Un trío fantástico — se integraron en la fiesta",
      fr: "Un trio fantastique — ils se sont intégrés à la fête",
    },
    text: {
      pt: "Para um dia inesquecível queríamos uma equipa que se integrasse com os nossos convidados e vivesse a festa connosco. Foi exatamente isso que tivemos com este trio fantástico. Não tivemos 3 colaboradores — tivemos 3 convidados que captaram momentos únicos. As fotos foram exatamente como queríamos: naturais, divertidas, cheias de emoção e vida. Obrigada, Gonçalo, Miguel e Glória!",
      de: "Für einen unvergesslichen Tag wollten wir ein Team, das sich unter unsere Gäste mischt und die Feier wirklich miterlebt. Genau das hatten wir mit diesem fantastischen Trio. Wir hatten nicht 3 Dienstleister — wir hatten 3 Gäste, die einzigartige Momente eingefangen haben. Die Fotos waren genau so, wie wir es wollten: natürlich, lustig, voller Emotion und Leben. Danke, Gonçalo, Miguel und Glória!",
      es: "Para un día inolvidable queríamos un equipo que se integrara con nuestros invitados y viviera la fiesta de verdad. Eso es exactamente lo que tuvimos con este trío fantástico. No tuvimos 3 colaboradores — tuvimos 3 invitados que capturaron momentos únicos. Las fotos fueron justo como queríamos: naturales, divertidas, llenas de emoción y vida. ¡Gracias, Gonçalo, Miguel y Glória!",
      fr: "Pour un jour inoubliable, nous voulions une équipe capable de se mêler à nos invités et de vivre vraiment la fête. C'est exactement ce que nous avons eu avec ce trio fantastique. Nous n'avons pas eu 3 prestataires — nous avons eu 3 invités qui ont capturé des moments uniques. Les photos étaient exactement comme nous le souhaitions : naturelles, joyeuses, pleines d'émotion et de vie. Merci, Gonçalo, Miguel et Glória !",
    },
  },
  {
    id: "e2f7c252-89b8-4b62-a431-010a161123ed",
    title: {
      pt: "A melhor escolha que poderíamos ter feito",
      de: "Die beste Entscheidung, die wir treffen konnten",
      es: "La mejor elección que podíamos haber hecho",
      fr: "Le meilleur choix que nous aurions pu faire",
    },
    text: {
      pt: "O Gonçalo foi sem dúvida a melhor escolha que poderíamos ter feito para o nosso grande dia!\n\nNo início procurávamos um fotógrafo pela qualidade, originalidade e naturalidade do trabalho. Quando finalmente conhecemos o Gonçalo soubemos logo que era o nosso fotógrafo. Extremamente profissional, atento e com um olhar incrível para os detalhes. Captou cada momento de forma única e as fotos ficaram exatamente como tínhamos sonhado. Muito obrigada, Gonçalo!",
      de: "Gonçalo war ohne Zweifel die beste Entscheidung, die wir für unseren großen Tag treffen konnten!\n\nAnfangs suchten wir einen Fotografen nach Qualität, Originalität und Natürlichkeit der Arbeit. Als wir Gonçalo schließlich kennenlernten, wussten wir sofort: Er ist unser Fotograf. Extrem professionell, aufmerksam und mit einem unglaublichen Blick fürs Detail. Er hat jeden Moment auf einzigartige Weise eingefangen, und unsere Fotos sind genau so geworden, wie wir es uns erträumt hatten. Vielen Dank, Gonçalo!",
      es: "Gonçalo fue sin duda la mejor elección que podíamos haber hecho para nuestro gran día!\n\nAl principio buscábamos un fotógrafo por la calidad, originalidad y naturalidad de su trabajo. Cuando por fin conocimos a Gonçalo supimos enseguida que era nuestro fotógrafo. Extremadamente profesional, atento y con un ojo increíble para los detalles. Capturó cada momento de manera única, y nuestras fotos quedaron exactamente como las habíamos soñado. ¡Muchísimas gracias, Gonçalo!",
      fr: "Gonçalo a été sans aucun doute le meilleur choix que nous aurions pu faire pour notre grand jour !\n\nAu départ, nous cherchions un photographe pour la qualité, l'originalité et le naturel de son travail. Quand nous avons enfin rencontré Gonçalo, nous avons tout de suite su qu'il était notre photographe. Extrêmement professionnel, attentif et doté d'un œil incroyable pour les détails. Il a capturé chaque moment de manière unique et nos photos sont exactement comme nous les avions rêvées. Merci infiniment, Gonçalo !",
    },
  },
  {
    id: "5f8e4246-0fe8-4a82-b167-237b30be7ef0",
    title: {
      pt: "Bom serviço e ótima relação qualidade/preço",
      de: "Guter Service und tolles Preis-Leistungs-Verhältnis",
      es: "Buen servicio y excelente relación calidad/precio",
      fr: "Bon service et excellent rapport qualité-prix",
    },
    text: {
      pt: "Bom serviço e ótima relação qualidade/preço. Contratámos o pacote com 2 fotógrafos, videógrafo e drone. São excelentes profissionais, embora tenham chegado um pouco atrasados, o que me desorientou e acabei por esquecer algumas fotos que tinha planeado. Ainda assim, o resultado final ficou lindo e temos ótimas memórias do nosso dia.",
      de: "Guter Service und ausgezeichnetes Preis-Leistungs-Verhältnis. Wir haben das Paket mit 2 Fotografen, Videograf und Drohne gebucht. Sie sind hervorragende Profis, kamen allerdings ein bisschen zu spät, was mich etwas aus dem Konzept brachte und dazu führte, dass ich einige geplante Fotos vergessen habe. Trotzdem ist das Endergebnis wunderschön geworden und wir haben tolle Erinnerungen an unseren Tag.",
      es: "Buen servicio y excelente relación calidad/precio. Contratamos el paquete con 2 fotógrafos, videógrafo y dron. Son excelentes profesionales, aunque llegaron un poco tarde, lo que me descolocó un poco y al final me olvidé de algunas fotos que tenía planeadas. Aun así, el resultado final fue precioso y tenemos unos recuerdos maravillosos de nuestro día.",
      fr: "Bon service et excellent rapport qualité-prix. Nous avons réservé le forfait avec 2 photographes, vidéaste et drone. Ce sont d'excellents professionnels, même s'ils sont arrivés un peu en retard, ce qui m'a un peu perturbée et j'ai fini par oublier certaines photos que j'avais prévues. Malgré tout, le résultat final est magnifique et nous avons de superbes souvenirs de notre journée.",
    },
  },
  {
    id: "59b6ddc1-7222-4543-9f03-9aa97e46959e",
    title: {
      pt: "Fotos naturais e lindas, sem encenações",
      de: "Natürliche, wunderschöne Fotos ohne Inszenierung",
      es: "Fotos naturales y preciosas, sin poses",
      fr: "Photos naturelles et magnifiques, sans mise en scène",
    },
    text: {
      pt: "Quando vi o portfólio do Gonçalo soube logo que era exatamente o que queria. Fotos naturais e lindas, sem encenações, o que nos deixou completamente à vontade. Fez uma reportagem incrível e inesquecível. Tenho fotos em que nem me lembro dele estar lá — de tão discreto que foi. Um verdadeiro grande profissional e uma pessoa maravilhosa.",
      de: "Als ich Gonçalos Portfolio sah, wusste ich sofort: Genau das wollte ich. Natürliche, wunderschöne Fotos ohne jede Inszenierung — das hat uns vollkommen entspannt. Er hat eine unglaubliche, unvergessliche Reportage gemacht. Auf manchen Fotos kann ich mich nicht einmal daran erinnern, dass er da war — so dezent war er. Ein wirklich großartiger Profi und ein wunderbarer Mensch.",
      es: "Cuando vi el portfolio de Gonçalo supe que era justo lo que quería. Fotos naturales y preciosas, sin ninguna pose, lo que nos hizo sentir totalmente cómodos. Hizo un reportaje increíble e inolvidable. Tengo fotos en las que ni recuerdo que estuviera allí — de lo discreto que fue. Un grandísimo profesional y una persona maravillosa.",
      fr: "Quand j'ai vu le portfolio de Gonçalo, j'ai su que c'était exactement ce que je voulais. Des photos naturelles et magnifiques, sans aucune mise en scène, ce qui nous a totalement mis à l'aise. Il a réalisé un reportage incroyable et inoubliable. J'ai des photos où je ne me souviens même pas qu'il était là, tant il a été discret. Un vrai grand professionnel et une personne merveilleuse.",
    },
  },
  {
    id: "a5f4beeb-f7bd-44ec-8211-401b7b2d3cb8",
    title: {
      pt: "Exatamente o que procurávamos",
      de: "Genau das, was wir gesucht haben",
      es: "Exactamente lo que buscábamos",
      fr: "Exactement ce que nous cherchions",
    },
    text: {
      pt: "Durante os preparativos do casamento, escolher o fotógrafo foi a tarefa mais difícil para nós. Vários fatores eram fundamentais: fotos tradicionais, mas nem demasiado filtradas nem demasiado simples ou forçadas, com um toque de fotojornalismo. Encontrámos tudo isso no trabalho do Gonçalo. No dia do casamento foi discreto e ao mesmo tempo sempre presente nos momentos-chave, e o resultado final superou tudo o que esperávamos. Recomendo vivamente!",
      de: "Während der Hochzeitsvorbereitungen war die Wahl des Fotografen für uns die schwierigste Aufgabe. Mehrere Punkte waren entscheidend: traditionelle Fotos, weder zu stark gefiltert noch zu schlicht oder gestellt, mit einer fotojournalistischen Note. All das haben wir in Gonçalos Arbeit gefunden. Am Hochzeitstag war er dezent und zugleich in allen Schlüsselmomenten präsent, und das Endergebnis hat alles übertroffen, was wir uns erhofft hatten. Sehr zu empfehlen!",
      es: "Durante los preparativos de la boda, elegir al fotógrafo fue la tarea más difícil para nosotros. Varios factores eran clave: fotos tradicionales, pero ni demasiado filtradas ni demasiado simples o forzadas, con un toque de fotoperiodismo. Encontramos todo eso en el trabajo de Gonçalo. El día de la boda fue discreto y a la vez siempre presente en los momentos clave, y el resultado final superó con creces lo que esperábamos. ¡Muy recomendable!",
      fr: "Pendant les préparatifs du mariage, choisir le photographe a été la tâche la plus difficile. Plusieurs critères étaient essentiels : des photos traditionnelles, ni trop filtrées ni trop simples ou figées, avec une touche de photojournalisme. Nous avons trouvé tout cela dans le travail de Gonçalo. Le jour du mariage, il a été discret tout en étant toujours présent aux moments clés, et le résultat final a dépassé toutes nos attentes. Vivement recommandé !",
    },
  },
  {
    id: "a0f77291-8420-46bc-b92f-af3c614711e1",
    title: {
      pt: "A melhor decisão que poderíamos ter tomado",
      de: "Die beste Entscheidung, die wir treffen konnten",
      es: "La mejor decisión que podíamos haber tomado",
      fr: "La meilleure décision que nous aurions pu prendre",
    },
    text: {
      pt: "Escolher o fotógrafo é, sem dúvida, uma das maiores decisões na organização de um casamento. Felizmente tivemos a oportunidade de ver o trabalho do Gonçalo antes do nosso casamento, o que tornou a decisão muito mais fácil.\n\nO Gonçalo e o Miguel estiveram sempre no sítio certo à hora certa, atentos, discretos e incrivelmente profissionais. O resultado final superou as nossas expectativas. Não podíamos recomendar mais!",
      de: "Die Wahl des Fotografen ist zweifellos eine der größten Entscheidungen bei der Organisation einer Hochzeit. Zum Glück hatten wir die Möglichkeit, Gonçalos Arbeit schon vor unserer Hochzeit zu sehen, was die Entscheidung deutlich erleichtert hat.\n\nGonçalo und Miguel waren immer zur richtigen Zeit am richtigen Ort, aufmerksam, dezent und unglaublich professionell. Das Endergebnis hat unsere Erwartungen weit übertroffen. Wir können sie wärmstens empfehlen!",
      es: "Elegir al fotógrafo es, sin duda, una de las mayores decisiones al organizar una boda. Por suerte tuvimos la oportunidad de ver el trabajo de Gonçalo antes de nuestra boda, lo que nos facilitó mucho la decisión.\n\nGonçalo y Miguel estuvieron siempre en el lugar adecuado en el momento adecuado, atentos, discretos e increíblemente profesionales. El resultado final superó nuestras expectativas. ¡No podemos recomendarlos más!",
      fr: "Choisir le photographe est sans doute l'une des plus grandes décisions lors de l'organisation d'un mariage. Heureusement, nous avons eu l'occasion de voir le travail de Gonçalo avant notre mariage, ce qui a beaucoup facilité notre choix.\n\nGonçalo et Miguel étaient toujours au bon endroit au bon moment, attentifs, discrets et incroyablement professionnels. Le résultat final a dépassé nos attentes. Nous ne pouvons que les recommander vivement !",
    },
  },
  {
    id: "707a1736-d02a-4de6-b863-41e2583d8f45",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Muito obrigada, adorei o tempo que passei contigo. E aprendi muito a ver-te a fotografar-me. Espero ficar com a mesma à-vontade contigo enquanto me fotografo a mim própria no resto da viagem.",
      de: "Vielen Dank, ich habe die Zeit mit dir wirklich genossen. Und beim Zusehen, wie du mich fotografierst, habe ich viel gelernt. Ich hoffe, dass ich mich mit dir genauso wohlfühlen werde, während ich mich auf dem Rest meiner Reise selbst fotografiere.",
      es: "Muchísimas gracias, disfruté un montón el tiempo contigo. Y aprendí viéndote fotografiarme. Espero quedarme con la misma soltura que tuve contigo mientras me fotografío a mí misma durante el resto de mi viaje.",
      fr: "Merci beaucoup, j'ai vraiment adoré le temps passé avec toi. Et j'ai beaucoup appris en te regardant me photographier. J'espère garder la même aisance que j'avais avec toi pour me photographier moi-même tout au long du reste de mon voyage.",
    },
  },
  {
    id: "5a802dd0-852d-4e27-8efc-e3610fca7a4b",
    title: {
      pt: "Excelente fotógrafo",
      de: "Ausgezeichneter Fotograf",
      es: "Excelente fotógrafo",
      fr: "Excellent photographe",
    },
    text: {
      pt: "Sem dúvida a nossa melhor escolha. Logo na primeira reunião apaixonámo-nos pelo trabalho dele. Ao longo do dia o Gonçalo foi um excelente profissional — paciente e capaz de nos deixar à vontade (algo que pensávamos ser impossível, porque não gostamos de ser fotografados). Depois do casamento, ao ver o resultado final, quase quisemos que o Gonçalo pudesse fotografar todos os momentos das nossas vidas! Obrigada, Gonçalo.",
      de: "Ohne Zweifel unsere beste Wahl. Schon beim ersten Treffen haben wir uns in seine Arbeit verliebt. Den ganzen Tag über war Gonçalo ein hervorragender Profi — geduldig und in der Lage, uns zu entspannen (etwas, das wir für unmöglich hielten, weil wir uns nicht gern fotografieren lassen). Nach unserer Hochzeit, beim Anblick des Endergebnisses, hätten wir uns fast gewünscht, dass Gonçalo jeden Moment unseres Lebens fotografieren könnte! Danke, Gonçalo.",
      es: "Sin duda nuestra mejor elección. Desde la primera reunión nos enamoramos de su trabajo. Durante todo el día Gonçalo fue un excelente profesional — paciente y capaz de hacernos sentir cómodos (algo que creíamos imposible porque no nos gusta que nos hagan fotos). Después de la boda, al ver el resultado final, ¡casi deseamos que Gonçalo pudiera fotografiar cada momento de nuestras vidas! Gracias, Gonçalo.",
      fr: "Sans aucun doute notre meilleur choix. Dès la première rencontre, nous sommes tombés amoureux de son travail. Tout au long de la journée, Gonçalo a été un excellent professionnel — patient et capable de nous mettre à l'aise (ce que nous pensions impossible, car nous n'aimons pas être photographiés). Après notre mariage, en voyant le résultat final, nous avons presque eu envie que Gonçalo puisse photographier chaque moment de notre vie ! Merci, Gonçalo.",
    },
  },
  {
    id: "9d27b00d-94f8-4647-bd69-c15511d5f3ab",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Ótimo passeio fotográfico! Recomendo!",
      de: "Schöne Foto-Tour! Sehr zu empfehlen!",
      es: "¡Bonito tour fotográfico! ¡Recomendable!",
      fr: "Belle balade photo ! Je recommande !",
    },
  },
  {
    id: "64d4bb78-87c2-459a-9502-f8b5c377f625",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O meu marido, a minha filha e eu marcámos uma sessão fotográfica com a Tatiana e ainda bem que o fizemos. A Tatiana tem uma personalidade tão calorosa e acolhedora — fez-nos sentir confortáveis e captou na perfeição a nossa manhã juntos. Entregou-nos as fotos muito rapidamente e ficámos SUPER felizes com elas. Foi uma experiência maravilhosa e estou encantada por ter fotos tão incríveis do nosso tempo em Lisboa. Recomendo vivamente!",
      de: "Mein Mann, unsere Tochter und ich haben ein Fotoshooting mit Tatiana gebucht — und ich bin so froh darüber. Tatiana hat eine so herzliche und einladende Art — sie hat uns sofort wohlfühlen lassen und unseren gemeinsamen Morgen perfekt eingefangen. Sie hat uns die Fotos sehr schnell geliefert, und wir sind unglaublich glücklich damit. Es war eine wunderbare Erfahrung, und ich freue mich riesig über diese tollen Bilder unserer Zeit in Lissabon. Sehr zu empfehlen!",
      es: "Mi marido, mi hija y yo reservamos una sesión de fotos con Tatiana y me alegra mucho haberlo hecho. Tatiana tiene una personalidad muy cálida y acogedora — nos hizo sentir cómodos y capturó nuestra mañana juntos a la perfección. Nos entregó las fotos rapidísimo y estamos SÚPER contentos con ellas. Fue una experiencia maravillosa y me hace muy feliz tener unas fotos tan increíbles de nuestro tiempo en Lisboa. ¡Muy recomendable!",
      fr: "Mon mari, ma fille et moi avons réservé une séance photo avec Tatiana et je suis ravie de l'avoir fait. Tatiana a une personnalité tellement chaleureuse et accueillante — elle nous a tout de suite mis à l'aise et a parfaitement capturé notre matinée ensemble. Elle nous a livré les photos très rapidement et nous en sommes ABSOLUMENT ravis. Une expérience merveilleuse, et je suis tellement heureuse d'avoir d'aussi belles photos de notre séjour à Lisbonne. Vivement recommandé !",
    },
  },
  {
    id: "967b9e80-ceb1-487e-92b2-d9f9845cd6ae",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A nossa sessão fotográfica com a Tatiana foi incrível! Levou-nos a muitos dos pontos clássicos de Lisboa e também a alguns sítios escondidos. As fotos que recebemos foram tratadas profissionalmente e realçaram o nosso tempo em Lisboa. Da próxima vez que voltarmos a Lisboa, marcamos certamente outra sessão com a Tatiana para ter fotos da nossa filha à medida que cresce!",
      de: "Unser Fotoshooting mit Tatiana war fantastisch! Sie hat uns zu vielen klassischen Lissabon-Spots geführt, aber auch zu einigen versteckten Geheimtipps. Die Fotos waren professionell bearbeitet und haben unsere Zeit in Lissabon wunderbar in Szene gesetzt. Beim nächsten Lissabon-Besuch werden wir Tatiana auf jeden Fall wieder buchen, um Fotos zu haben, während unsere Tochter größer wird!",
      es: "¡Nuestra sesión de fotos con Tatiana fue increíble! Nos llevó a muchos de los lugares clásicos de Lisboa y también a algunos rincones escondidos. Las fotos que recibimos estaban procesadas profesionalmente y realzaron nuestro tiempo en Lisboa. La próxima vez que volvamos a Lisboa reservaremos sin duda otra sesión con Tatiana para tener fotos de nuestra hija a medida que crece.",
      fr: "Notre séance photo avec Tatiana était incroyable ! Elle nous a emmenés dans de nombreux endroits classiques de Lisbonne, mais aussi dans des coins plus secrets. Les photos étaient retouchées de manière très professionnelle et mettaient parfaitement en valeur notre séjour à Lisbonne. La prochaine fois que nous reviendrons à Lisbonne, nous réserverons sans hésiter une nouvelle séance avec Tatiana pour avoir des photos de notre fille au fil du temps !",
    },
  },
  {
    id: "f30c67ac-9633-433e-8e2c-42c992d2d773",
    title: {
      pt: "Profissional, atento e adorável com os convidados",
      de: "Professionell, aufmerksam und reizend mit den Gästen",
      es: "Profesional, atento y encantador con los invitados",
      fr: "Professionnel, attentif et adorable avec les invités",
    },
    text: {
      pt: "O Gonçalo é um fotógrafo super profissional — não houve um único contratempo e esteve sempre atento para captar os momentos mais importantes do casamento. Adorámos a postura e a forma como trabalha — integrou-se perfeitamente no espírito da festa sem nunca ser intrusivo. Além disso, é extremamente simpático e paciente, sempre disponível para acolher os pedidos dos noivos. Os preços são muito competitivos. Um serviço 5 estrelas, recomendo vivamente!",
      de: "Gonçalo ist ein hochprofessioneller Fotograf — es gab nicht einen einzigen Fehlgriff, und er war stets aufmerksam, um die wichtigsten Momente der Hochzeit einzufangen. Wir haben seine Haltung und Arbeitsweise sehr geschätzt — er hat sich perfekt in die Stimmung der Feier eingefügt, ohne je aufdringlich zu sein. Außerdem ist er extrem freundlich und geduldig, immer bereit, auf die Wünsche des Brautpaars einzugehen. Sehr faire Preise. Ein Service mit fünf Sternen — sehr zu empfehlen!",
      es: "Gonçalo es un fotógrafo súper profesional — no hubo ni un solo contratiempo y estuvo siempre atento para capturar los momentos más importantes de la boda. Nos encantó su actitud y su forma de trabajar — se integró perfectamente en el ambiente de la fiesta sin resultar nunca invasivo. Además, es extremadamente amable y paciente, siempre dispuesto a atender las peticiones de los novios. Sus precios son muy competitivos. Un servicio de 5 estrellas, ¡muy recomendable!",
      fr: "Gonçalo est un photographe super professionnel — il n'y a eu aucun couac et il était toujours attentif pour capturer les moments les plus importants du mariage. Nous avons beaucoup apprécié son attitude et sa façon de travailler — il s'est parfaitement fondu dans l'ambiance de la fête sans jamais être intrusif. En plus, il est extrêmement sympathique et patient, toujours prêt à répondre aux demandes des mariés. Ses tarifs sont très compétitifs. Un service 5 étoiles, vivement recommandé !",
    },
  },
  {
    id: "2fd47b6c-7832-4e3d-84ef-c975ae0a2389",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Tatiana é fantástica no que faz! Foi muito simpática e fez-me sentir super à vontade. Adorei as fotos. :) Muito obrigada!!",
      de: "Tatiana ist großartig in dem, was sie tut! Sie war sehr freundlich und hat mich sofort wohlfühlen lassen. Die Fotos liebe ich. :) Vielen Dank!!",
      es: "¡Tatiana es genial en lo que hace! Fue muy simpática y me hizo sentir súper cómoda. ¡Me encantaron las fotos! :) ¡¡Muchas gracias!!",
      fr: "Tatiana est incroyable dans ce qu'elle fait ! Elle a été très sympa et m'a tout de suite mise à l'aise. J'ai adoré mes photos. :) Merci beaucoup !!",
    },
  },
  {
    id: "b9f6a53c-68ac-477e-8769-747f512cfce3",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "É uma experiência interessante e a Tatiana é muito atenciosa, por isso ficamos super satisfeitos com o trabalho.",
      de: "Es ist eine interessante Erfahrung und Tatiana ist sehr entgegenkommend — am Ende ist man rundum zufrieden mit dem Ergebnis.",
      es: "Es una experiencia interesante y Tatiana es muy atenta, así que acabas muy contento con el trabajo.",
      fr: "C'est une expérience intéressante et Tatiana est très attentionnée, on finit donc très satisfait du travail.",
    },
  },
  {
    id: "d33464f0-dd56-4f83-88e4-83d673d04373",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Tatiana é muito simpática e cheia de energia. Apesar de termos vergonha da câmara e nos sentirmos um pouco desajeitados, ela conseguiu deixar-nos rapidamente à vontade. Foi uma manhã divertida a descobrir o bairro da Mouraria e a sermos fotografados — uma boa recordação da nossa viagem a Lisboa. Mostrou-nos sítios interessantes, contou-nos histórias de fadistas conhecidos e deu-nos recomendações de bons sítios para comer. Estamos contentes por termos escolhido esta experiência com a Tatiana.",
      de: "Tatiana ist sehr freundlich und sprudelt nur so vor Energie. Obwohl wir vor der Kamera schüchtern und etwas unbeholfen waren, hat sie uns schnell entspannen lassen. Es war ein lustiger Vormittag, das Mouraria-Viertel zu entdecken und sich fotografieren zu lassen — eine schöne Erinnerung an unsere Lissabon-Reise. Sie hat uns interessante Orte gezeigt, von bekannten Fado-Sängerinnen erzählt und Empfehlungen für gute Restaurants gegeben. Wir sind froh, dass wir diese Erfahrung mit Tatiana gewählt haben.",
      es: "Tatiana es muy simpática y llena de energía. Aunque éramos tímidos delante de la cámara y un poco torpes, supo ponernos cómodos enseguida. Fue una mañana divertida descubriendo el barrio de la Mouraria y haciéndonos fotos — un bonito recuerdo de nuestro viaje a Lisboa. Nos enseñó sitios interesantes, historias de fadistas conocidas y nos recomendó buenos lugares para comer. Nos alegra haber elegido esta experiencia con Tatiana.",
      fr: "Tatiana est très sympathique et pleine de pep. Même si nous étions timides devant l'objectif et un peu maladroits, elle a su nous mettre rapidement à l'aise. Une matinée amusante à découvrir le quartier de la Mouraria en se faisant photographier — un beau souvenir de notre voyage à Lisbonne. Elle nous a montré des endroits intéressants, raconté des histoires de fadistas célèbres et recommandé de bonnes adresses pour manger. Nous sommes ravis d'avoir choisi cette expérience avec Tatiana.",
    },
  },
  {
    id: "4d4bffe3-98a4-4f78-a9d9-4154f4bd8649",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Positivo\nQualidade, Profissionalismo, Relação preço/qualidade",
      de: "Positiv\nQualität, Professionalität, Preis-Leistung",
      es: "Positivo\nCalidad, Profesionalidad, Relación calidad-precio",
      fr: "Positif\nQualité, Professionnalisme, Rapport qualité-prix",
    },
  },
  {
    id: "67ab5854-133f-4238-81fa-3364af1e52b0",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Fizemos uma sessão de bebé com a Sophie e recomendamos vivamente! A sessão foi em nossa casa e, com a personalidade calorosa e simpática da Sophie, sentimo-nos completamente à vontade. As fotos ficaram ainda mais bonitas do que imaginávamos. Não estávamos perfeitamente preparados com um recém-nascido, mas a Sophie teve muita paciência connosco e imensas boas ideias. As fotos não são preparadas nem artificiais, exatamente como esperávamos, mas muito bem feitas — as melhores recordações de uma fase muito especial. Queremos voltar a marcar com a Sophie quando a nossa filha for um pouco mais velha, já que cada idade é especial e fofa! Só temos pena de não termos marcado também uma sessão de gravidez, mas para a próxima não falha!\nObrigada, Sophie\n🙏1\nSophie Bellmann — Fotógrafa em Lisboa e Costa da Caparica",
      de: "Wir hatten ein Baby-Shooting mit Sophie und können es absolut empfehlen! Das Shooting fand bei uns zu Hause statt, und durch Sophies herzliche und freundliche Art fühlte es sich völlig entspannt an. Die Bilder sind sogar noch viel schöner geworden, als ich es mir vorgestellt hatte. Wir waren mit dem Neugeborenen nicht perfekt vorbereitet, aber sie hatte viel Geduld mit uns und viele gute Ideen. Die Bilder sind nicht gestellt und unnatürlich, genau wie wir es uns gewünscht hatten, sondern wunderschön gemacht — die besten Erinnerungen an eine ganz besondere Zeit. Wir möchten Sophie unbedingt wieder buchen, wenn unsere Tochter etwas älter ist, denn jedes Alter ist so besonders und süß! Schade nur, dass wir nicht auch ein Babybauch-Shooting gemacht haben, aber das holen wir beim nächsten Mal definitiv nach!\nDanke, Sophie\n🙏1\nSophie Bellmann — Fotografin in Lissabon & Costa da Caparica",
      es: "Hicimos una sesión de bebé con Sophie y la recomendamos totalmente. La sesión fue en nuestra casa y, con la personalidad cálida y amable de Sophie, nos sentimos completamente cómodos. Las fotos son incluso más bonitas de lo que imaginábamos. No íbamos perfectamente preparados con un recién nacido, pero ella tuvo mucha paciencia con nosotros y un montón de buenas ideas. Las fotos no son posadas ni artificiales, justo como queríamos, pero están muy bien tomadas — los mejores recuerdos de una época muy especial. Queremos volver a reservar con Sophie cuando nuestra hija sea un poco mayor, porque cada edad es especial y preciosa. ¡Solo nos da pena no haber reservado una sesión de embarazo, pero seguro que lo haremos la próxima vez!\nGracias, Sophie\n🙏1\nSophie Bellmann — Fotógrafa en Lisboa y Costa da Caparica",
      fr: "Nous avons fait une séance bébé avec Sophie et nous la recommandons totalement ! La séance a eu lieu chez nous et, grâce à la personnalité chaleureuse et amicale de Sophie, nous nous sommes sentis complètement à l'aise. Les photos sont encore plus belles que ce que j'imaginais. Nous n'étions pas parfaitement préparés avec un nouveau-né, mais elle a eu beaucoup de patience avec nous et plein de bonnes idées. Les photos ne sont pas figées ni artificielles, exactement comme nous le voulions, mais magnifiquement réalisées — les meilleurs souvenirs d'une période très spéciale. Nous voulons reprendre rendez-vous avec Sophie quand notre fille sera un peu plus grande, car chaque âge est si spécial et si mignon ! On regrette juste de ne pas avoir réservé aussi une séance grossesse, mais nous le ferons sans faute la prochaine fois !\nMerci Sophie\n🙏1\nSophie Bellmann — Photographe à Lisbonne et Costa da Caparica",
    },
  },
  {
    id: "8a12be97-c761-4ad9-9415-6c93ea5381a6",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Sophie é uma profissional que nos faz sentir nós próprios durante toda a sessão. Não vais experimentar poses superficiais durante o shoot e, quando vires as fotos, vais sentir-te a pessoa mais bonita do mundo ;)",
      de: "Sophie ist eine Profi, die einen sich während der ganzen Session ganz man selbst fühlen lässt. Beim Shooting wird man keine oberflächlichen Posen erleben, und wenn man die Fotos sieht, fühlt man sich wie die schönste Person der Welt ;)",
      es: "Sophie es una profesional que te hace sentir tú misma durante toda la sesión. No vas a experimentar poses superficiales durante el shoot y, cuando veas las fotos, te sentirás la persona más guapa del mundo ;)",
      fr: "Sophie est une professionnelle qui te fait te sentir toi-même tout au long de la séance. Tu ne feras aucune pose superficielle pendant le shooting et, quand tu verras les photos, tu te sentiras la plus belle personne au monde ;)",
    },
  },
  {
    id: "bf228a23-eed3-452e-9894-1de18bf7472e",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Sophie fez-me sentir segura e ajudou-me a expressar-me para tirar as fotos mais bonitas.\n🙏1\nSophie Bellmann — Fotógrafa em Lisboa e Costa da Caparica",
      de: "Sophie hat mir ein sicheres Gefühl gegeben und mir geholfen, mich auszudrücken, damit die schönsten Bilder entstehen.\n🙏1\nSophie Bellmann — Fotografin in Lissabon & Costa da Caparica",
      es: "Sophie me hizo sentir segura y me ayudó a expresarme para conseguir las fotos más bonitas.\n🙏1\nSophie Bellmann — Fotógrafa en Lisboa y Costa da Caparica",
      fr: "Sophie m'a mise en confiance et m'a aidée à m'exprimer pour obtenir les plus belles photos.\n🙏1\nSophie Bellmann — Photographe à Lisbonne et Costa da Caparica",
    },
  },
  {
    id: "aef69d22-c707-4371-853c-ea43d6f7bbca",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Excelente trabalho 👏👏 …",
      de: "Tolle Arbeit 👏👏 …",
      es: "Gran trabajo 👏👏 …",
      fr: "Super travail 👏👏 …",
    },
  },
  {
    id: "3fab7aa8-9765-43bc-b1e2-b1dc2261da3f",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Positivo\nResposta, Qualidade, Profissionalismo, Relação preço/qualidade",
      de: "Positiv\nReaktionsfähigkeit, Qualität, Professionalität, Preis-Leistung",
      es: "Positivo\nCapacidad de respuesta, Calidad, Profesionalidad, Relación calidad-precio",
      fr: "Positif\nRéactivité, Qualité, Professionnalisme, Rapport qualité-prix",
    },
  },
  {
    id: "3c1069c2-06e8-416e-b95e-34953ef57cba",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Que momento incrível! As meninas são maravilhosas, senti-me leve e super à vontade.\nObrigada pela experiência e pela excelência ♥️\nAdorámos!\nPositivo\nProfissionalismo",
      de: "Was für ein unglaublicher Moment! Die Mädels sind wunderbar, ich habe mich leicht und total wohl gefühlt.\nDanke für die Erfahrung und für diese Exzellenz ♥️\nWir haben es geliebt!\nPositiv\nProfessionalität",
      es: "¡Qué momento tan increíble! Las chicas son maravillosas, me sentí ligera y súper cómoda.\nGracias por la experiencia y por la excelencia ♥️\n¡Nos encantó!\nPositivo\nProfesionalidad",
      fr: "Quel moment incroyable ! Les filles sont merveilleuses, je me suis sentie légère et super à l'aise.\nMerci pour l'expérience et pour l'excellence ♥️\nNous avons adoré !\nPositif\nProfessionnalisme",
    },
  },
  {
    id: "2c0cd35e-ca10-40c3-b0e3-1e83b73b23a3",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Profissionais maravilhosas, ela é simplesmente INCRÍVEL. A experiência da sessão foi MARAVILHOSA e cheia de gargalhadas que tiraram o nervosismo das poses! Recomendo super!!! Até à próxima, com certeza!!!! 10000",
      de: "Großartige Profis, sie ist einfach UMWERFEND. Das Shooting-Erlebnis war WUNDERVOLL und voller Lacher, die jede Posier-Nervosität verfliegen ließen! Absolute Empfehlung!!! Bis zum nächsten Mal, ganz sicher!!!! 10000",
      es: "Profesionales maravillosas, es simplemente INCREÍBLE. ¡La experiencia de la sesión fue MARAVILLOSA y con muchísimas risas que quitaron los nervios de las poses! ¡La recomiendo muchísimo!!! Hasta la próxima, ¡seguro!!!! 10000",
      fr: "Des professionnelles formidables, elle est tout simplement INCROYABLE. L'expérience du shooting a été MERVEILLEUSE, avec plein de fous rires qui ont chassé le stress des poses ! Je recommande vivement !!! À la prochaine, c'est sûr !!!! 10000",
    },
  },
  {
    id: "3b606e28-1269-4c7e-8436-651b05f2689d",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A melhor fotógrafa de sempre!! Ótima relação qualidade/preço e qualidade excelente.",
      de: "Die beste Fotografin überhaupt!! Tolles Preis-Leistungs-Verhältnis, hervorragende Qualität.",
      es: "¡¡La mejor fotógrafa de siempre!! Muy buena relación calidad/precio y calidad excelente.",
      fr: "La meilleure photographe de tous les temps !! Excellent rapport qualité-prix et qualité au top.",
    },
  },
  {
    id: "617ff929-5123-4867-92c0-82a970ad61c8",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Positivo\nProfissionalismo",
      de: "Positiv\nProfessionalität",
      es: "Positivo\nProfesionalidad",
      fr: "Positif\nProfessionnalisme",
    },
  },
  {
    id: "40b67253-ce9d-49dd-b5e3-2e8600e8aca4",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Chris é uma profissional incrível e um ser humano maravilhoso. Tem um dom natural para a arte, para a fotografia, e o trabalho dela é único. Torna tudo mais leve com a sua personalidade. Foi uma experiência fantástica fazer a sessão com ela. Recomendo muito!\nPositivo\nResposta, Qualidade, Profissionalismo, Relação preço/qualidade",
      de: "Chris ist eine unglaubliche Profi und ein wunderbarer Mensch. Sie hat ein natürliches Talent für Kunst, für Fotografie, und ihre Arbeit ist einzigartig. Mit ihrer Persönlichkeit macht sie alles leichter. Es war eine fantastische Erfahrung, das Shooting mit ihr zu machen. Sehr zu empfehlen!\nPositiv\nReaktionsfähigkeit, Qualität, Professionalität, Preis-Leistung",
      es: "Chris es una profesional increíble y un ser humano maravilloso. Tiene un don natural para el arte, para la fotografía, y su trabajo es único. Lo hace todo más ligero con su personalidad. Fue una experiencia fantástica hacer la sesión con ella. ¡La recomiendo muchísimo!\nPositivo\nCapacidad de respuesta, Calidad, Profesionalidad, Relación calidad-precio",
      fr: "Chris est une professionnelle incroyable et un être humain merveilleux. Elle a un don naturel pour l'art, pour la photographie, et son travail est unique. Elle rend tout plus léger avec sa personnalité. La séance avec elle a été une expérience fantastique. Je la recommande vivement !\nPositif\nRéactivité, Qualité, Professionnalisme, Rapport qualité-prix",
    },
  },
  {
    id: "13409d9b-e69a-44ff-936c-e9e61b84f00b",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Simplesmente o melhor! Adorei as fotos!",
      de: "Einfach der/die Beste! Ich liebe die Fotos!",
      es: "¡Simplemente la mejor! ¡Me encantaron las fotos!",
      fr: "Tout simplement la meilleure ! J'ai adoré les photos !",
    },
  },
];

const client = new Client({
  user: "photoportugal",
  password: "PhotoPortugal2026Secure",
  host: "localhost",
  database: "photoportugal",
  port: 5432,
});

await client.connect();

for (const r of REV) {
  const cols = [];
  const params = [];
  for (const loc of ["pt", "de", "es", "fr"]) {
    if (r.title?.[loc] !== undefined) {
      cols.push(`title_${loc} = $${params.length + 1}`);
      params.push(r.title[loc] || null);
    }
    if (r.text?.[loc] !== undefined) {
      cols.push(`text_${loc} = $${params.length + 1}`);
      params.push(r.text[loc] || null);
    }
  }
  cols.push(`translations_dirty = FALSE`);
  params.push(r.id);
  await client.query(
    `UPDATE reviews SET ${cols.join(", ")} WHERE id = $${params.length}`,
    params
  );
  console.log(`✓ ${r.id.slice(0, 8)}`);
}

await client.end();
console.log(`\nBatch rev-1 done — ${REV.length} reviews translated.`);
